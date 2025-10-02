// Utility functions for user data storage with Chrome compatibility

export const setUserData = (userData: any) => {
  const userDataString = JSON.stringify(userData)
  
  // Store in localStorage
  try {
    localStorage.setItem('user', userDataString)
  } catch (error) {
    console.warn('localStorage not available:', error)
  }
  
  // Store in cookie as fallback for Chrome
  try {
    document.cookie = `user=${encodeURIComponent(userDataString)}; path=/; max-age=86400; SameSite=Lax; Secure=${window.location.protocol === 'https:'}`
  } catch (error) {
    console.warn('Cookie storage failed:', error)
  }
}

export const getUserData = () => {
  // Try localStorage first
  try {
    const userData = localStorage.getItem('user')
    if (userData) return userData
  } catch (error) {
    console.warn('localStorage read failed:', error)
  }
  
  // Fallback to cookie
  try {
    const cookies = document.cookie.split(';')
    const userCookie = cookies.find(cookie => cookie.trim().startsWith('user='))
    if (userCookie) {
      return decodeURIComponent(userCookie.split('=')[1])
    }
  } catch (error) {
    console.warn('Cookie read failed:', error)
  }
  
  return null
}

export const clearUserData = () => {
  // Clear localStorage
  try {
    localStorage.removeItem('user')
  } catch (error) {
    console.warn('localStorage clear failed:', error)
  }
  
  // Clear cookie
  try {
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  } catch (error) {
    console.warn('Cookie clear failed:', error)
  }
}