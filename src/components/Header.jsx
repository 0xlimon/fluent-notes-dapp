import React from 'react';
import ConnectWallet from './ConnectWallet';

/**
 * Header component with application title and wallet connection
 * @param {Object} props - Component props
 * @param {string} props.account - Connected wallet address
 * @param {Function} props.onConnect - Callback when wallet is connected
 */
const Header = ({ account, onConnect }) => {
  return (
    <header className="bg-white border-b border-gray-200 shadow-md py-2 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4 md:px-6">
        <div className="flex justify-between items-center">
          {/* Logo and Title */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md transform transition-transform hover:scale-105">
              <svg 
                className="w-6 h-6 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M9 12h6m-6 4h6m-6-8h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
                Blockchain Notes
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 flex items-center">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                notes on Fluent blockchain
              </p>
            </div>
          </div>
          
          {/* Wallet Connection */}
          <ConnectWallet onConnected={onConnect} />
        </div>
      </div>
    </header>
  );
};

export default Header;