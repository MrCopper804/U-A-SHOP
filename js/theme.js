import { getLocalStorage, setLocalStorage } from './utils.js';

const THEME_KEY = 'uashop_theme';

export function initTheme() {
  const savedTheme = getLocalStorage(THEME_KEY, 'light');
  setTheme(savedTheme);
  
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    updateThemeIcon(savedTheme);
  }
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  setLocalStorage(THEME_KEY, theme);
  updateThemeIcon(theme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function updateThemeIcon(theme) {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }
}

document.addEventListener('DOMContentLoaded', initTheme);
