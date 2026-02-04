import React from 'react';
import ReactDOM from 'react-dom/client';
import BiFocus from './bifocus.jsx';

// Mock window.storage avec localStorage pour la production
// (En dev avec Claude, window.storage est fourni)
if (!window.storage) {
  window.storage = {
    async get(key, shared = false) {
      try {
        const value = localStorage.getItem(key);
        return value ? { key, value, shared } : null;
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },
    
    async set(key, value, shared = false) {
      try {
        localStorage.setItem(key, value);
        return { key, value, shared };
      } catch (error) {
        console.error('Storage set error:', error);
        return null;
      }
    },
    
    async delete(key, shared = false) {
      try {
        localStorage.removeItem(key);
        return { key, deleted: true, shared };
      } catch (error) {
        console.error('Storage delete error:', error);
        return null;
      }
    },
    
    async list(prefix = '', shared = false) {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith(prefix)) {
            keys.push(key);
          }
        }
        return { keys, prefix, shared };
      } catch (error) {
        console.error('Storage list error:', error);
        return null;
      }
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BiFocus />
);
