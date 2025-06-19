import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/providers/theme-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { LearnCoursePage } from '@/pages/learn-course'
import { LoginPage } from '@/pages/auth/login'
import { SignUpPage } from '@/pages/auth/signup'
import { ForgotPasswordPage } from '@/pages/auth/forgot-password'
import { Toaster } from '@/components/ui/toaster'
import './App.css'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="orion-ui-theme">
      <AuthProvider>
        <Router>
          <Routes>
            {/* Auth routes - no protection needed */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            
            {/* Course learning - protected route */}
            <Route 
              path="/courses/:courseId/learn" 
              element={
                <ProtectedRoute>
                  <LearnCoursePage />
                </ProtectedRoute>
              } 
            />
            
            {/* Default redirect - redirect to external courses page */}
            <Route 
              path="/" 
              element={
                <Navigate 
                  to="https://everythinglearn.online/courses" 
                  replace 
                />
              } 
            />
            
            {/* Catch all route - redirect to external courses page */}
            <Route 
              path="*" 
              element={
                <Navigate 
                  to="https://everythinglearn.online/courses" 
                  replace 
                />
              } 
            />
          </Routes>
          <Toaster />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App