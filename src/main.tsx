import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Guard } from './Guard';
import './style.css';
createRoot(document.getElementById('root')!).render(<Guard><App /></Guard>);
