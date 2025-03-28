import React from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

const Popup = () => {
  return (
    <div className="popup-container">
      <h1>Popup</h1>
      <p>这是您的插件</p>
    </div>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);