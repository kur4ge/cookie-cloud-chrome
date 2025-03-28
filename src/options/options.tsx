import React from 'react';
import ReactDOM from 'react-dom/client';
import './options.css';

const Options = () => {
  return (
    <div className="options-container">
      <h1>Options</h1>
      <p>这是您的插件</p>
    </div>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);