import React, { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import Header from './components/Header';
import NotesList from './components/NotesList';
import NoteEditor from './components/NoteEditor';
import { CONTRACT_ADDRESSES } from './contracts/addresses';
import { SecureNotesRustABI, SecureNotesABI } from './contracts/abis';

/**
 * Contract Diagnostics Component for troubleshooting contract issues
 */
const ContractDiagnostics = ({ provider, account, onClose }) => {
  const [diagnosticState, setDiagnosticState] = useState({
    running: false,
    completed: false,
    results: {
      contract: { valid: false, error: null },
      noteCreation: { valid: false, error: null },
      encryption: { valid: false, error: null }
    }
  });
  
  const runDiagnostics = async () => {
    if (!provider || !account) {
      return;
    }
    
    setDiagnosticState(prev => ({
      ...prev,
      running: true,
      completed: false
    }));
    
    const results = {
      contract: { valid: false, error: null },
      noteCreation: { valid: false, error: null },
      encryption: { valid: false, error: null }
    };
    
    try {
      // Step 1: Check if address is valid
      if (!ethers.utils.isAddress(CONTRACT_ADDRESSES.SECURE_NOTES_RUST)) {
        results.contract.error = "Invalid contract address format";
      }
      
      // Step 2: Try to connect to the unified Rust contract
      try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          CONTRACT_ADDRESSES.SECURE_NOTES_RUST,
          SecureNotesRustABI,
          signer
        );
        
        // Try to call a view function to see if contract exists and responds
        try {
          const encryptionAddress = await contract.getEncryptionContractAddress({
            gasLimit: 100000
          });
          
          console.log("Contract check succeeded:", encryptionAddress);
          results.contract.valid = true;
          
          // Since we're using a unified contract, the encryption contract address should match itself
          if (encryptionAddress.toLowerCase() !== CONTRACT_ADDRESSES.SECURE_NOTES_RUST.toLowerCase()) {
            console.warn("Note: Contract returned a different address, but this is expected with the new unified architecture");
          }
        } catch (viewErr) {
          console.error("Contract view function failed:", viewErr);
          results.contract.error = "Contract exists but view function failed: " + 
            (viewErr.message || "Unknown error");
        }
        
        // Try to encrypt some test data
        try {
          const encryptedData = await contract.encryptNote("Test content", {
            gasLimit: 150000
          });
          
          console.log("Encryption test succeeded:", encryptedData);
          results.encryption.valid = true;
        } catch (encryptErr) {
          console.error("Encryption test failed:", encryptErr);
          results.encryption.error = "Failed to encrypt test data: " + 
            (encryptErr.message || "Unknown error");
        }
        
        // Try to check note count (tests note creation capability)
        try {
          await contract.getNoteCount({
            gasLimit: 100000
          });
          
          console.log("Note creation capability check succeeded");
          results.noteCreation.valid = true;
        } catch (noteErr) {
          console.error("Note creation capability check failed:", noteErr);
          results.noteCreation.error = "Failed to check note count: " + 
            (noteErr.message || "Unknown error");
        }
      } catch (err) {
        console.error("Contract connection failed:", err);
        results.contract.error = "Failed to connect to contract: " + 
          (err.message || "Unknown error");
      }
    } catch (e) {
      console.error("Diagnostic error:", e);
    } finally {
      // Update state with results
      setDiagnosticState({
        running: false,
        completed: true,
        results
      });
    }
  };
  
  useEffect(() => {
    runDiagnostics();
  }, [provider, account]);
  
  // Generate recommendations based on diagnostic results
  const getRecommendations = () => {
    const { results } = diagnosticState;
    const recommendations = [];
    
    if (!results.contract.valid) {
      recommendations.push(
        "Check that the contract is properly deployed at address: " + 
        CONTRACT_ADDRESSES.SECURE_NOTES_RUST
      );
    }
    
    if (results.contract.valid && !results.encryption.valid) {
      recommendations.push(
        "The contract exists but encryption functionality isn't working. This may indicate a problem with the contract deployment."
      );
    }
    
    if (results.contract.valid && !results.noteCreation.valid) {
      recommendations.push(
        "The contract exists but note creation functionality isn't working. You may need to register your wallet first."
      );
    }
    
    if (recommendations.length === 0) {
      if (results.contract.valid && results.encryption.valid && results.noteCreation.valid) {
        recommendations.push(
          "The contract appears to be working correctly. If you're still experiencing issues, try registering your wallet again."
        );
      } else {
        recommendations.push(
          "Check that the contract is deployed and functioning correctly on the Fluent Devnet."
        );
      }
    }
    
    return recommendations;
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 animate-fade-in">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-semibold text-gray-800">
            Contract Diagnostics
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="mt-4">
          {diagnosticState.running ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">Running contract diagnostics...</p>
            </div>
          ) : diagnosticState.completed ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Contract Status */}
                <div className={`border rounded-lg p-4 ${
                  diagnosticState.results.contract.valid 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start">
                    <div className={`rounded-full p-2 mr-3 ${
                      diagnosticState.results.contract.valid 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {diagnosticState.results.contract.valid ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">Contract Connection</h3>
                      <p className={`text-sm ${
                        diagnosticState.results.contract.valid 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {diagnosticState.results.contract.valid
                          ? "Connected successfully"
                          : diagnosticState.results.contract.error || "Connection failed"}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Encryption Status */}
                <div className={`border rounded-lg p-4 ${
                  diagnosticState.results.encryption.valid 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start">
                    <div className={`rounded-full p-2 mr-3 ${
                      diagnosticState.results.encryption.valid 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {diagnosticState.results.encryption.valid ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">Encryption Functionality</h3>
                      <p className={`text-sm ${
                        diagnosticState.results.encryption.valid 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {diagnosticState.results.encryption.valid
                          ? "Encryption working"
                          : diagnosticState.results.encryption.error || "Encryption failed"}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Note Creation Status */}
                <div className={`border rounded-lg p-4 ${
                  diagnosticState.results.noteCreation.valid 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start">
                    <div className={`rounded-full p-2 mr-3 ${
                      diagnosticState.results.noteCreation.valid 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {diagnosticState.results.noteCreation.valid ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">Note Creation</h3>
                      <p className={`text-sm ${
                        diagnosticState.results.noteCreation.valid 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {diagnosticState.results.noteCreation.valid
                          ? "Note creation ready"
                          : diagnosticState.results.noteCreation.error || "Note creation not available"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Contract Addresses */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-800 mb-2">Contract Address</h3>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <p className="text-sm text-gray-600">Unified Rust Contract:</p>
                    <code className="text-xs bg-white p-1 rounded border border-gray-200 block overflow-x-auto">
                      {CONTRACT_ADDRESSES.SECURE_NOTES_RUST}
                    </code>
                  </div>
                </div>
              </div>
              
              {/* Recommendations */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-yellow-800 mb-2">Recommendations</h3>
                <ul className="space-y-2">
                  {getRecommendations().map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                      <span className="text-sm text-yellow-800">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={runDiagnostics}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Run Again
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600">Ready to run diagnostics.</p>
              <button
                onClick={runDiagnostics}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                Start Diagnostics
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Modal component for registration feedback
 */
const RegistrationModal = ({ status, onClose, onRetry }) => {
  if (!status.showRegistrationModal) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-fade-in">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-semibold text-gray-800">
            {status.isRegistered ? "Registration Complete" : "Registration Required"}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="mt-4">
          {status.registrationInProgress ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600 text-center">
                Registering your wallet with the Blockchain Notes contract...
                <br />
                <span className="text-sm text-gray-500 mt-2 block">
                  Please confirm the transaction in your wallet
                </span>
              </p>
            </div>
          ) : status.isRegistered ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <p className="text-green-700">
                  Your wallet has been successfully registered. You can now create and manage personal notes.
                </p>
              </div>
            </div>
          ) : (
            <>
              {status.registrationError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p className="text-red-700">{status.registrationError}</p>
                  </div>
                </div>
              )}
              
              <p className="text-gray-600 mb-4">
                To use Blockchain Notes, you need to register your wallet with the smart contract. This is a one-time process.
              </p>
              
              <div className="flex justify-end">
                <button
                  onClick={onRetry}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Register Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Main App component that orchestrates the application
 */
const App = () => {
  // State for wallet connection
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  
  // State for notes interaction and registration status
  const [noteState, setNoteState] = useState({
    selectedNoteId: null,
    isEditing: false,
    editorKey: 'initial', // Stable key that doesn't change on every render
    refreshTrigger: Date.now() // Used to trigger notes list refresh
  });
  
  // Add registration tracking state
  const [registrationStatus, setRegistrationStatus] = useState({
    isRegistered: false, 
    registrationInProgress: false,
    registrationError: null,
    showRegistrationModal: false
  });
  
  // Add state to track contract availability
  const [contractStatus, setContractStatus] = useState({
    notesContractAvailable: false,
    encryptionContractAvailable: false,
    checkingContracts: false,
    contractError: null,
    showDiagnostics: false
  });
  
  // No explicit registration check - the contract auto-registers users when they perform actions
  // We'll let the contract handle this automatically
  
  /**
   * Handle wallet connection
   * @param {string} walletAddress - Connected wallet address
   * @param {Object} ethersProvider - Ethers provider
   */
  const handleConnect = useCallback((walletAddress, ethersProvider) => {
    console.log(`Wallet connected: ${walletAddress}`);
    
    setAccount(walletAddress);
    setProvider(ethersProvider);
    
    // Reset selected note when wallet changes - batch update
    setNoteState({
      selectedNoteId: null,
      isEditing: false,
      editorKey: 'wallet-change'
    });
    
    // No registration check - contract handles auto-registration when needed
  }, []);
  
  
  /**
   * Handle note selection
   * @param {number} noteId - Selected note ID
   */
  const handleSelectNote = useCallback((noteId) => {
    console.log(`Selected note ID: ${noteId}`);
    // Batch state update to avoid race conditions
    setNoteState(prev => ({
      selectedNoteId: noteId,
      isEditing: false,
      editorKey: `view-${noteId}`
    }));
  }, []);
  
  /**
   * Handle creating a new note
   */
  const handleCreateNote = useCallback(() => {
    // No registration check - assume all connected users can create notes
    console.log("Creating new note");
    // Batch state update to avoid race conditions and flicker
    setNoteState({
      selectedNoteId: null,
      isEditing: true,
      editorKey: `create-${Date.now().toString(36)}` // Unique but stable key
    });
  }, []);
  
  /**
   * Handle editing a note
   */
  const handleEditNote = useCallback(() => {
    const { selectedNoteId } = noteState;
    if (selectedNoteId !== null) {
      console.log(`Editing note with ID: ${selectedNoteId}`);
      // Batch state update
      setNoteState(prev => ({
        ...prev,
        isEditing: true,
        editorKey: `edit-${selectedNoteId}-${Date.now().toString(36)}`
      }));
    }
  }, [noteState]);
  
  /**
   * Handle note save completion with improved refresh coordination
   */
  const handleNoteSaved = useCallback((noteId) => {
    console.log("Note saved with ID:", noteId, "- exiting edit mode and preparing to refresh list");
    
    // First update UI to show we're exiting edit mode
    setNoteState(prev => ({
      ...prev,
      selectedNoteId: noteId || prev.selectedNoteId,
      isEditing: false,
      editorKey: `saved-${noteId || prev.selectedNoteId || 'new'}`
    }));
    
    // Force a longer delay to ensure blockchain has enough time to confirm transaction
    // Using a tiered approach with multiple refresh attempts
    console.log("Starting refresh sequence with delays");
    
    // First attempt after 2 seconds
    setTimeout(() => {
      console.log("First refresh attempt (2s delay)");
      setNoteState(prev => ({
        ...prev,
        refreshTrigger: Date.now()
      }));
      
      // Second attempt after 4 more seconds if needed
      setTimeout(() => {
        console.log("Second refresh attempt (6s total delay)");
        setNoteState(prev => ({
          ...prev, 
          refreshTrigger: Date.now()
        }));
      }, 4000);
    }, 2000);
    
  }, []);
  
  /**
   * Handle canceling note edit
   */
  const handleCancelEdit = useCallback(() => {
    console.log("Edit canceled");
    
    // Get current state for reference
    const { selectedNoteId, isEditing } = noteState;
    
    // When canceling from a new note (selectedNoteId is null), 
    // show the "No Note Selected" screen instead of a blank form
    if (selectedNoteId === null && isEditing) {
      console.log("Canceling new note creation, returning to welcome screen");
      setNoteState(prev => ({
        ...prev,
        isEditing: false,
        // Keep selectedNoteId as null to show the welcome screen
        editorKey: `canceled-${Date.now().toString(36)}`
      }));
    } 
    // When canceling an edit of an existing note, 
    // return to viewing that note
    else if (selectedNoteId !== null) {
      console.log(`Canceling edit of note ${selectedNoteId}, returning to view mode`);
      setNoteState(prev => ({
        ...prev,
        isEditing: false,
        // Keep the same selectedNoteId to return to viewing that note
        editorKey: `view-${selectedNoteId}-${Date.now().toString(36)}`
      }));
    }
    // Fallback for any other state
    else {
      console.log("Canceling edit with no selected note");
      setNoteState(prev => ({
        ...prev,
        isEditing: false,
        // Keep selectedNoteId as null to show the welcome screen
        editorKey: `welcome-${Date.now().toString(36)}`
      }));
    }
  }, [noteState]);
  
  
  /**
   * Render the main content based on application state
   */
  const renderMainContent = () => {
    const { selectedNoteId, isEditing, editorKey } = noteState;
    
    console.log("Rendering main content:", { account, isEditing, selectedNoteId });
    
    if (!account) {
      console.log("No account connected");
      return (
        <div className="animate-fade-in mt-10 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-md">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 text-gray-800 leading-tight">
              Welcome to Blockchain Notes
            </h2>
            <p className="text-gray-600 mb-12 text-lg max-w-xl mx-auto">
              Your personal notes stored on the Fluent blockchain
            </p>
            
            <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8">
              <div className="bg-blue-50 rounded-lg p-6 text-center border border-blue-100 shadow-sm transform transition hover:scale-105">
                <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Private</h3>
                <p className="text-gray-600 text-sm">Your notes are stored privately on blockchain</p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-6 text-center border border-blue-100 shadow-sm transform transition hover:scale-105">
                <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Decentralized</h3>
                <p className="text-gray-600 text-sm">Stored on the blockchain, not on servers</p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-6 text-center border border-blue-100 shadow-sm transform transition hover:scale-105">
                <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Accessible</h3>
                <p className="text-gray-600 text-sm">Access your notes from anywhere</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    
    return (
      <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] gap-4 sm:gap-6 mt-4 sm:mt-6 animate-fade-in">
          {/* Sidebar with notes list */}
          <div className="w-full md:w-2/5 lg:w-1/3 xl:w-1/4 md:h-full overflow-hidden transform transition-all">
            <NotesList
              contractAddress={CONTRACT_ADDRESSES.SECURE_NOTES_RUST}
              provider={provider}
              account={account}
              onSelectNote={handleSelectNote}
              onCreateNote={handleCreateNote}
              isRegistered={true} // Always consider connected wallets as registered
              refreshTrigger={noteState.refreshTrigger} // Pass refresh trigger to force refresh
            />
          </div>
        
        {/* Main content area */}
        <div className="w-full lg:w-2/3 xl:w-3/4 lg:h-full transform transition-all duration-300">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-full overflow-hidden">
            {isEditing ? (
              <div className="h-full overflow-auto">
                <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 p-5">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    {selectedNoteId === null ? (
                      <>
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                        Create New Note
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Edit Note
                      </>
                    )}
                  </h2>
                </div>
                <div className="p-6">
                  <NoteEditor
                    contractAddress={CONTRACT_ADDRESSES.SECURE_NOTES_RUST}
                    provider={provider}
                    account={account}
                    noteId={selectedNoteId}
                    onSaved={handleNoteSaved}
                    onCancel={handleCancelEdit}
                    key={editorKey} // Use stable key strategy
                  />
                </div>
              </div>
            ) : selectedNoteId !== null ? (
              <div className="h-full overflow-auto">
                <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 p-5 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    View Note
                  </h2>
                  <button 
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                    onClick={handleEditNote}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    Edit
                  </button>
                </div>
                <div className="p-6">
                  <NoteEditor
                    contractAddress={CONTRACT_ADDRESSES.SECURE_NOTES_RUST}
                    provider={provider}
                    account={account}
                    noteId={selectedNoteId}
                    onCancel={handleCancelEdit}
                    key={editorKey} // Use stable key strategy
                    readOnly={true}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <div className="text-center max-w-md transform transition-all duration-300 hover:scale-105">
                  <div className="rounded-full bg-blue-50 p-6 mx-auto w-28 h-28 flex items-center justify-center mb-6">
                    <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">No Note Selected</h3>
                  <p className="text-gray-600 mb-8">
                    Select a note from the list or create a new note to get started
                  </p>
                  <button 
                    className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg shadow-md text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transform transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={handleCreateNote}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Create New Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Toggle diagnostic tool visibility
  const toggleDiagnostics = useCallback(() => {
    setContractStatus(prev => ({
      ...prev,
      showDiagnostics: !prev.showDiagnostics
    }));
  }, []);

  // Close diagnostic tool
  const closeDiagnostics = useCallback(() => {
    setContractStatus(prev => ({
      ...prev,
      showDiagnostics: false
    }));
  }, []);

  return (
    <div className="bg-gradient-to-br from-blue-50 via-gray-50 to-blue-50 min-h-screen flex flex-col">
      <Header 
        account={account}
        onConnect={handleConnect} 
      />
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-4 flex-grow">
        {/* Debug Button for Contract Diagnostics */}
        {account && (
          <div className="mb-2 flex justify-end">
            <button
              onClick={toggleDiagnostics}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
              </svg>
              Diagnostics
            </button>
          </div>
        )}
        
        {renderMainContent()}
      </main>
      
      {/* No registration modal - contract handles auto-registration */}
      
      {/* Contract Diagnostics modal */}
      {contractStatus.showDiagnostics && (
        <ContractDiagnostics
          provider={provider}
          account={account}
          onClose={closeDiagnostics}
        />
      )}
      
      {/* Developer Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-gray-600 text-sm">
          <div className="mb-3 sm:mb-0">
            <span className="font-medium">Developer:</span> 0xLimon
          </div>
          <div className="flex items-center space-x-4">
            <a href="https://twitter.com/zxLimon_" target="_blank" rel="noopener noreferrer" 
               className="flex items-center hover:text-blue-500 transition-colors">
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              @zxLimon_
            </a>
            <a href="https://github.com/0xlimon/fluent-notes-dapp" target="_blank" rel="noopener noreferrer"
               className="flex items-center hover:text-gray-900 transition-colors">
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              fluent-notes-dapp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;