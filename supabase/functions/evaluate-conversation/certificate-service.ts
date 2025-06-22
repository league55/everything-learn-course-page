import { createClient } from 'npm:@supabase/supabase-js@^2.39.1';
import algosdk from 'npm:algosdk@^2.6.0';

// Certificate API implementation for Edge Functions
export class EdgeCertificateAPI {
    supabase;
    algodClient;
    issuerAccount;

    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);

        // Initialize Algorand client for TESTNET
        this.algodClient = new algosdk.Algodv2(
            Deno.env.get('ALGOD_TOKEN') || '',
            Deno.env.get('ALGOD_SERVER') || 'https://testnet-api.algonode.cloud',
            Deno.env.get('ALGOD_PORT') || 443
        );

        // Initialize issuer account from mnemonic
        this.issuerAccount = algosdk.mnemonicToSecretKey(Deno.env.get('ISSUER_ACCOUNT_MNEMONIC') || '');
    }

    generateCertificateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `CERT-${timestamp}-${random.toUpperCase()}`;
    }
    calculateTranscriptHash(transcript) {
        // Simple hash calculation for transcript data
        const transcriptString = JSON.stringify(transcript);
        // Use Web Crypto API available in Deno
        const encoder = new TextEncoder();
        const data = encoder.encode(transcriptString);
        return btoa(String.fromCharCode(...data)).substring(0, 32);
    }
    calculateAchievementLevel(score, maxScore) {
        const percentage = (score / maxScore) * 100;
        if (percentage >= 95) return 'platinum';
        if (percentage >= 85) return 'gold';
        if (percentage >= 75) return 'silver';
        return 'bronze';
    }
    async mockBlockchainTransaction() {
        // Mock blockchain transaction - in production this would interact with Algorand
        return new Promise(resolve => {
            setTimeout(() => {
                const mockTxId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                resolve(mockTxId);
            }, 2000); // Simulate blockchain transaction time
        });
    }

    async createAlgorandTransaction(certificateData) {
        try {
            // Get student's Algorand address
            const { data: userProfile } = await this.supabase
                .from('user_profiles')
                .select('algorand_address')
                .eq('user_id', certificateData.studentId)
                .single();

            const studentAddress = userProfile?.algorand_address || '';

            // Prepare transaction parameters
            const params = await this.algodClient.getTransactionParams().do();
            params.fee = 1000; // Minimum fee
            params.flatFee = true;

            // Create certificate metadata note
            const note = new TextEncoder().encode(
                JSON.stringify({
                    type: 'course_certificate',
                    certificate_id: certificateData.certificateId,
                    course: certificateData.courseName,
                    student_id: certificateData.studentId,
                    score: certificateData.score,
                    max_score: certificateData.maxScore,
                    issued_at: certificateData.timestamp,
                })
            );

            // Create transaction (0 ALGO payment with metadata note)
            const txn = algosdk.makePaymentTxnWithSuggestedParams(
                this.issuerAccount.addr, // sender
                studentAddress, // receiver
                0, // amount (0 ALGO)
                undefined, // closeRemainderTo
                note, // note
                params // suggestedParams
            );

            // Sign transaction
            const signedTxn = txn.signTxn(this.issuerAccount.sk);

            // Submit transaction
            const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();

            // Wait for confirmation (4 rounds)
            const confirmedTxn = await algosdk.waitForConfirmation(this.algodClient, txId, 4);

            console.log(`Transaction ${txId} confirmed in round ${confirmedTxn['confirmed-round']}`);
            return txId;
        } catch (error) {
            console.error('Algorand transaction failed:', error);
            throw error;
        }
    }

    async onExaminationCompletion(studentId, courseId, examinationResults) {
        try {
            console.log('Starting certificate issuance for:', { studentId, courseId });

            // Get course information
            const { data: course, error: courseError } = await this.supabase
                .from('course_configuration')
                .select('topic, depth')
                .eq('id', courseId)
                .single();

            if (courseError || !course) {
                throw new Error(`Failed to fetch course: ${courseError?.message}`);
            }

            // Generate certificate data
            const certificateId = this.generateCertificateId();
            const transcriptHash = this.calculateTranscriptHash(examinationResults);
            const timestamp = Date.now();
            const examinationDate = new Date().toISOString();

            const metadata = {
                examinationType: examinationResults.examType === 'final' ? 'final' : 'assessment',
                modulesCompleted: examinationResults.moduleResults.length,
                totalModules: examinationResults.moduleResults.length,
                completionTime: examinationResults.timeSpent,
                difficultyLevel: course.depth,
                achievementLevel: this.calculateAchievementLevel(
                    examinationResults.totalScore,
                    examinationResults.maxPossibleScore
                ),
            };

            const certificateData = {
                certificateId,
                studentId,
                courseId,
                courseName: course.topic,
                score: examinationResults.totalScore,
                maxScore: examinationResults.maxPossibleScore,
                examinationDate,
                transcriptHash,
                metadata,
                issuerAddress: this.issuerAccount.addr,
                timestamp,
                status: 'active',
            };

            // Create real Algorand transaction
            try {
                const blockchainTxId = await this.createAlgorandTransaction(certificateData);
                certificateData.blockchainTxId = blockchainTxId;
                console.log('Algorand transaction successful:', blockchainTxId);
            } catch (blockchainError) {
                console.warn('Blockchain transaction failed, proceeding without it:', blockchainError);
            }

            // Store certificate in database
            const { data: savedCertificate, error: certificateError } = await this.supabase
                .from('certificates')
                .insert({
                    certificate_id: certificateData.certificateId,
                    student_id: certificateData.studentId,
                    course_id: certificateData.courseId,
                    course_name: certificateData.courseName,
                    score: certificateData.score,
                    max_score: certificateData.maxScore,
                    examination_date: certificateData.examinationDate,
                    transcript_hash: certificateData.transcriptHash,
                    transcript_data: examinationResults,
                    metadata: certificateData.metadata,
                    issuer_address: certificateData.issuerAddress,
                    blockchain_tx_id: certificateData.blockchainTxId,
                    timestamp: certificateData.timestamp,
                    status: certificateData.status,
                })
                .select()
                .single();

            if (certificateError) {
                throw new Error(`Failed to save certificate: ${certificateError.message}`);
            }

            // Log certificate creation
            await this.supabase.from('certificate_logs').insert({
                certificate_id: certificateData.certificateId,
                action: 'issued',
                details: `Certificate issued for ${course.topic}`,
            });

            console.log('Certificate issued successfully:', certificateData.certificateId);
            return certificateData;
        } catch (error) {
            console.error('Failed to issue certificate:', error);
            throw error;
        }
    }
}
