import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { showToast, showLoading, hideLoading, validateEmail, validatePassword, getLocalStorage, setLocalStorage, removeLocalStorage } from './utils.js';
import { mergeCartOnLogin } from './cart.js';

// Auth State Listener
export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setLocalStorage('currentUser', { ...userData, uid: user.uid });
        
        // Update UI
        updateAuthUI(userData);
        
        // Merge cart
        await mergeCartOnLogin(user.uid);
      }
    } else {
      removeLocalStorage('currentUser');
      updateAuthUI(null);
    }
  });
}

export async function signup(email, password, name) {
  try {
    showLoading();
    
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    if (!validatePassword(password)) {
      throw new Error('Password must be at least 6 characters');
    }
    
    if (!name.trim()) {
      throw new Error('Please enter your name');
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: name });
    
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      name: name,
      email: email,
      role: 'customer',
      createdAt: serverTimestamp()
    });
    
    showToast('Account created successfully!', 'success');
    window.location.href = 'index.html';
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

export async function login(email, password) {
  try {
    showLoading();
    
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    if (!password) {
      throw new Error('Please enter your password');
    }
    
    await signInWithEmailAndPassword(auth, email, password);
    showToast('Login successful!', 'success');
    window.location.href = 'index.html';
    
  } catch (error) {
    let message = error.message;
    if (error.code === 'auth/user-not-found') {
      message = 'No account found with this email';
    } else if (error.code === 'auth/wrong-password') {
      message = 'Incorrect password';
    } else if (error.code === 'auth/invalid-credential') {
      message = 'Invalid email or password';
    }
    showToast(message, 'error');
  } finally {
    hideLoading();
  }
}

export async function logout() {
  try {
    showLoading();
    await signOut(auth);
    removeLocalStorage('currentUser');
    removeLocalStorage('cart_guest');
    showToast('Logged out successfully', 'success');
    window.location.href = 'index.html';
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

export function getCurrentUser() {
  return getLocalStorage('currentUser');
}

export function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    showToast('Please login to continue', 'warning');
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

export function requireAdmin() {
  if (!requireAuth()) return false;
  if (!isAdmin()) {
    showToast('Access denied. Admin only.', 'error');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function updateAuthUI(userData) {
  const authButtons = document.querySelectorAll('.auth-btn');
  const userMenus = document.querySelectorAll('.user-menu');
  
  if (userData) {
    authButtons.forEach(btn => btn.style.display = 'none');
    userMenus.forEach(menu => {
      menu.style.display = 'flex';
      const nameEl = menu.querySelector('.user-name');
      if (nameEl) nameEl.textContent = userData.name;
    });
  } else {
    authButtons.forEach(btn => btn.style.display = 'flex');
    userMenus.forEach(menu => menu.style.display = 'none');
  }
}

// Form Handlers
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  
  // Signup Form
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
      
      await signup(email, password, name);
    });
  }
  
  // Login Form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      await login(email, password);
    });
  }
  
  // Logout Buttons
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', logout);
  });
  
  // Password Toggle
  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const input = toggle.previousElementSibling;
      const type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      toggle.textContent = type === 'password' ? '👁️' : '🙈';
    });
  });
});
