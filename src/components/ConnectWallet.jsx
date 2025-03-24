import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

/**
 * Component for handling wallet connection
 * @param {Object} props - Component props
 * @param {Function} props.onConnected - Callback when wallet is connected
 */
const ConnectWallet = ({ onConnected }) => {
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);
  // Add a flag to prevent auto-connection on initial page load
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  // Control dropdown menu visibility
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Set the initial load flag to true - this prevents auto-connection on first load
    setInitialLoadComplete(true);
    
    // Listen for account changes, but don't reconnect if manually disconnected
    if (window.ethereum && !manuallyDisconnected) {
      const handleAccountsChanged = async (accounts) => {
        // Clear current account first
        setAccount('');
        
        // If accounts exist and user hasn't manually disconnected
        if (accounts.length > 0 && !manuallyDisconnected) {
          try {
            setIsConnecting(true);
            setError('');
            
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const address = accounts[0];
            
            // Require signature verification when switching accounts
            const signatureVerified = await requestSignature(provider, address);
            
            if (signatureVerified) {
              setAccount(address);
              if (onConnected) {
                onConnected(address, provider);
              }
            }
          } catch (err) {
            console.error("Error handling account change:", err);
            setError("Failed to verify new wallet account.");
          } finally {
            setIsConnecting(false);
          }
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      // Cleanup listener when component unmounts
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [onConnected, manuallyDisconnected]);

  /**
   * Switch to Fluent network
   */
  const switchToFluentNetwork = async () => {
    if (!window.ethereum) return false;

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CONTRACT_ADDRESSES.NETWORK.chainId }],
      });
      return true;
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CONTRACT_ADDRESSES.NETWORK],
          });
          return true;
        } catch (addError) {
          console.error("Error adding network:", addError);
          setError("Failed to add Fluent network to wallet");
          return false;
        }
      } else {
        console.error("Error switching network:", switchError);
        setError("Failed to switch to Fluent network");
        return false;
      }
    }
  };

  /**
   * Request wallet signature to verify ownership
   */
  const requestSignature = async (provider, address) => {
    try {
      const signer = provider.getSigner();
      // Create a unique message that includes the user's address and a timestamp
      const message = `Blockchain Notes App Authentication\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      
      console.log("Requesting signature for message:", message);
      
      // Request signature from wallet
      const signature = await signer.signMessage(message);
      console.log("Signature received:", signature);
      
      // Verify the signature (optional extra check)
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
        console.log("Signature verified successfully");
        return true;
      } else {
        console.error("Signature verification failed");
        setError("Signature verification failed. Please try connecting again.");
        return false;
      }
    } catch (err) {
      console.error("Error requesting signature:", err);
      if (err.code === 4001) {
        // User rejected the signature request
        setError("You must sign the message to authenticate with the app.");
      } else {
        setError("Failed to verify wallet ownership: " + (err.message || ''));
      }
      return false;
    }
  };

  /**
   * Connect wallet
   */
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("No Ethereum wallet detected. Please install MetaMask.");
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      // Switch to the Fluent network
      const switched = await switchToFluentNetwork();
      if (!switched) {
        setIsConnecting(false);
        return;
      }

      // Request account access
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        const address = accounts[0];
        
        // Request signature to verify wallet ownership
        const signatureVerified = await requestSignature(provider, address);
        
        if (signatureVerified) {
          setAccount(address);
          if (onConnected) {
            onConnected(address, provider);
          }
        } else {
          // If signature verification failed or was rejected, disconnect
          setAccount('');
        }
      }
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError("Failed to connect wallet. " + (err.message || ''));
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnectWallet = () => {
    setAccount('');
    // Set the manually disconnected flag to prevent auto-reconnection
    setManuallyDisconnected(true);
    if (onConnected) {
      onConnected('', null);
    }
  };

  return (
    <div className="flex flex-col items-end">
      {!account ? (
        <button
          className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-medium rounded-md shadow-sm transition-all duration-300 hover:-translate-y-0.5 min-w-[120px] sm:min-w-[180px] justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      ) : (
        <div className="relative">
          {/* Dropdown Button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="flex items-center space-x-2 bg-white border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            {/* Status indicator */}
            <div className="relative w-2 h-2">
              <div className="w-2 h-2 bg-green-400 rounded-full absolute animate-pulse opacity-70"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full relative z-10"></div>
            </div>
            
            {/* Network and Address */}
            <div className="flex items-center">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mr-1.5">Fluent</span>
              <span className="text-sm font-medium text-gray-800">{account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
            </div>
            
            {/* Chevron icon */}
            <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isMenuOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
              {/* Wallet Info */}
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500">Connected Wallet</p>
                <div className="flex items-center mt-1">
                  <span className="text-sm font-medium text-gray-800 truncate">{account}</span>
                  <button 
                    className="ml-1 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(account);
                      setIsMenuOpen(false);
                    }}
                    title="Copy address"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Menu Items */}
              <div className="py-1">
                <button
                  className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => {
                    disconnectWallet();
                    setIsMenuOpen(false);
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                  </svg>
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-3 bg-red-50 text-red-600 p-3 rounded-md text-sm w-full border border-red-200 relative animate-fadeIn">
          <button 
            className="absolute top-2 right-2"
            onClick={() => setError('')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          <div className="pr-6">{error}</div>
        </div>
      )}
    </div>
  );
};

export default ConnectWallet;