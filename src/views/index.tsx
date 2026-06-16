import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';

/**
 * 路由入口：当前仅一个主视图，预留扩展空间
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/settings" element={<App />} />
      </Routes>
    </MemoryRouter>
  </React.StrictMode>,
);
