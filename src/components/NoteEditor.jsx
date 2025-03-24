import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SecureNotesABI } from '../contracts/abis';

/**
 * Note Editor component for creating and editing notes
 * @param {Object} props - Component props
 * @param {string} props.contractAddress - Address of the SecureNotes contract
 * @param {Object} props.provider - Ethers provider
 * @param {string} props.account - Connected wallet address
 * @param {number|null} props.noteId - ID of note to edit (null for new note)
 * @param {Function} props.onSaved - Callback when note is saved
 * @param {Function} props.onCancel - Callback when editing is cancelled
 * @param {boolean} props.readOnly - Whether the note is in read-only mode
 */
const NoteEditor = ({ contractAddress, provider, account, noteId, onSaved, onCancel, readOnly = false }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isNewNote, setIsNewNote] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  // Debug component props
  useEffect(() => {
    console.log('NoteEditor props:', { 
      contractAddress, 
      noteId, 
      readOnly,
      isNewNote: noteId === null || noteId === undefined
    });
  }, [contractAddress, noteId, readOnly]);

  // Fade in animation when component mounts
  useEffect(() => {
    setFadeIn(true);
  }, []);

  // Load note data when editing or viewing an existing note
  useEffect(() => {
    const loadNote = async () => {
      // Reset state for new form
      setTitle('');
      setContent('');
      setError('');
      setSuccess('');
      
      // Check if we're editing or viewing an existing note
      if (noteId !== null && noteId !== undefined) {
        setIsNewNote(false);
        setLoading(true);
        console.log(`Loading note ID: ${noteId}, readOnly: ${readOnly}`);
        
        try {
          if (!provider || !account || !contractAddress) {
            throw new Error("Missing required connection parameters");
          }
          
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(
            contractAddress,
            SecureNotesABI,
            signer
          );
          
          // Get note details
          const [fetchedTitle, fetchedContent] = await contract.getNote(noteId);
          console.log(`Note loaded - Title: ${fetchedTitle}, Content length: ${fetchedContent.length}`);
          
          setTitle(fetchedTitle);
          setContent(fetchedContent);
        } catch (err) {
          console.error("Error loading note:", err);
          setError("Failed to load note. " + (err.message || ''));
        } finally {
          setLoading(false);
        }
      } else {
        setIsNewNote(true);
        console.log("Creating new note");
      }
    };

    loadNote();
  }, [noteId, contractAddress, provider, account, readOnly]);

  /**
   * Handle form submission to save a note
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Form submitted");
    
    // Don't proceed if in read-only mode
    if (readOnly) {
      console.log("Form is read-only, not saving");
      return;
    }
    
    // Validate inputs
    if (!title.trim()) {
      setError("Please enter a title for your note");
      return;
    }
    
    if (!provider || !account || !contractAddress) {
      setError("Please connect your wallet first");
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      console.log("Saving note to blockchain...");
      const signer = await provider.getSigner();
      
      // Debug contract address
      console.log(`Using contract address: ${contractAddress}`);
      if (!ethers.utils.isAddress(contractAddress)) {
        throw new Error("Contract address is invalid. Please check your configuration.");
      }
      
      const contract = new ethers.Contract(
        contractAddress,
        SecureNotesABI,
        signer
      );
      
      // Debug: verify contract methods exist
      console.log("Contract methods:", Object.keys(contract.functions));
      
      // Debug: check if we have a signer
      if (!signer._isSigner) {
        throw new Error("No valid signer available. Please reconnect your wallet.");
      }
      
      let tx;
      
      try {
        if (isNewNote) {
          // Create new note
          console.log("Creating new note on blockchain");
          console.log("Params:", { title, contentLength: content.length });
          
          // Force a transaction to open the wallet
          // Skip gas estimation which might fail silently
          tx = await contract.createNote(title, content, {
            gasLimit: 500000, // Set a high enough gas limit to ensure tx goes through
            from: account // Explicitly set from address to trigger wallet
          });
          console.log("Transaction sent:", tx.hash);
        } else {
          // Update existing note
          console.log(`Updating note ID: ${noteId}`);
          console.log("Params:", { noteId, title, contentLength: content.length });
          
          // Force a transaction to open the wallet
          // Skip gas estimation which might fail silently
          tx = await contract.updateNote(noteId, title, content, {
            gasLimit: 500000, // Set a high enough gas limit to ensure tx goes through
            from: account // Explicitly set from address to trigger wallet
          });
          console.log("Transaction sent:", tx.hash);
        }
        
        // Wait for transaction to be mined
        console.log("Waiting for transaction confirmation...");
        await tx.wait();
        console.log("Transaction confirmed");
        
        // Show success message
        setSuccess(isNewNote ? "Note created successfully!" : "Note updated successfully!");
        console.log("Transaction confirmed - showing success message");
        
        // For new notes, get the noteId from the transaction events if possible
        let savedNoteId = isNewNote ? null : noteId;
        if (isNewNote && tx.hash) {
          try {
            const receipt = await tx.wait();
            console.log("Transaction receipt:", receipt);
            
            // Try to extract note ID from events
            if (receipt.events && receipt.events.length > 0) {
              // Look for a NoteCreated event with a noteId parameter
              const noteCreatedEvent = receipt.events.find(event => 
                event.event === 'NoteCreated' || 
                event.topics?.[0]?.includes('NoteCreated')
              );
              
              if (noteCreatedEvent && noteCreatedEvent.args?.noteId) {
                savedNoteId = noteCreatedEvent.args.noteId.toNumber();
                console.log("Extracted note ID from event:", savedNoteId);
              }
            }
          } catch (eventErr) {
            console.warn("Could not extract note ID from events:", eventErr);
            // Continue with null ID - it's not critical
          }
        }
        
        // Keep success message visible for 2 seconds before calling onSaved
        setTimeout(() => {
          console.log("Success message displayed for 2 seconds, now calling onSaved");
          if (onSaved) {
            console.log("Calling onSaved callback with noteId:", savedNoteId);
            onSaved(savedNoteId);
          }
        }, 2000);
      } catch (innerErr) {
        console.error("Transaction execution error:", innerErr);
        
        // Check for specific contract errors
        if (innerErr.error && innerErr.error.message) {
          throw new Error(innerErr.error.message);
        } else if (innerErr.message && innerErr.message.includes("user rejected")) {
          throw new Error("Transaction was rejected in your wallet.");
        } else if (innerErr.message && innerErr.message.includes("note does not exist")) {
          throw new Error("Note does not exist or you don't have permission to edit it.");
        } else if (innerErr.message && innerErr.message.includes("registered")) {
          throw new Error("Your wallet isn't correctly registered with the contract.");
        } else {
          throw innerErr; // Let the outer catch handle it
        }
      }
    } catch (err) {
        console.error("Error saving note (outer handler):", err);
      
      // Extract and analyze transaction receipt if available
      let receiptStatus = null;
      let transactionHash = null;
      
      if (err.receipt) {
        receiptStatus = err.receipt.status;
        transactionHash = err.receipt.transactionHash;
        console.log("Transaction receipt:", err.receipt);
      } else if (err.transaction && err.transaction.hash) {
        transactionHash = err.transaction.hash;
        console.log("Transaction hash:", transactionHash);
      }
      
      // Extract and format the error message for better user experience
      let errorMessage = "Failed to save note. ";
      
      // Check if the transaction was processed but failed (status = 0)
      if (receiptStatus === 0) {
        // This is the most common case when the encryption contract is missing or misconfigured
        errorMessage += "Transaction was sent to the blockchain but failed during execution. This is likely due to a problem with the encryption contract setup. ";
        errorMessage += "Check encryption contract address in src/contracts/addresses.js file.";
        
        // Add debug info
        if (transactionHash) {
          errorMessage += `\n\nTransaction Hash: ${transactionHash}`;
        }
      }
      // Transaction error messages for other cases
      else if (err.message && err.message.includes("execution reverted")) {
        errorMessage += "Transaction was rejected by the smart contract. There may be an issue with the encryption contract.";
      } else if (err.message && err.message.includes("UNPREDICTABLE_GAS_LIMIT")) {
        errorMessage += "Gas estimation failed. The contract or function may not exist at the specified address.";
      } else if (err.message && err.message.includes("insufficient funds")) {
        errorMessage += "Your wallet doesn't have enough ETH to pay for this transaction.";
      } else if (err.message && err.message.includes("contract not responding")) {
        errorMessage += "The encryption contract is not responding. Contract addresses may be incorrect.";
      } else if (err.message && err.message.includes("contract address is invalid")) {
        errorMessage += "One of the contract addresses is in an invalid format. Please check configuration.";
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += "Unknown error occurred. Check browser console for details.";
      }
      
      // Add suggestions for fixing
      errorMessage += "\n\nTo fix this issue:";
      errorMessage += "\n1. Check contract addresses in src/contracts/addresses.js";
      errorMessage += "\n2. Make sure both Solidity and Rust contracts are properly deployed";
      errorMessage += "\n3. Verify that your wallet has enough ETH for transaction fees";
      
      console.error("Detailed error:", err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle cancelling the edit
   */
  const handleCancel = () => {
    setFadeIn(false);
    setTimeout(() => {
      console.log("Edit cancelled");
      if (onCancel) {
        onCancel();
      }
    }, 300); // Wait for fade out animation before calling callback
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 min-h-[300px]">
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute top-0 w-16 h-16 animate-pulse rounded-full bg-blue-100 opacity-75"></div>
            <div className="absolute top-3 left-3 w-10 h-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </div>
          <span className="text-lg text-gray-700 font-medium">Loading note...</span>
          <p className="text-sm text-gray-500 mt-2">Retrieving encrypted data from blockchain</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`transform transition-opacity duration-500 ease-in-out ${fadeIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      <div className="bg-white bg-gradient-to-b from-gray-50 to-white rounded-lg shadow-lg max-w-3xl mx-auto p-6 relative border border-gray-200 overflow-hidden">
        {/* Status badge */}
        <div className="absolute top-4 right-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            isNewNote 
              ? 'bg-blue-100 text-blue-800' 
              : (readOnly 
                ? 'bg-gray-100 text-gray-800' 
                : 'bg-purple-100 text-purple-800')
          }`}>
            {isNewNote ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Note
              </>
            ) : readOnly ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                View Only
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit Mode
              </>
            )}
          </span>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-8 relative inline-block">
          {isNewNote ? "Create New Note" : (readOnly ? "View Note" : "Edit Note")}
          <span className="absolute -bottom-1 left-0 w-12 h-1 bg-blue-500 rounded-full"></span>
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="group">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2 flex items-center group-hover:text-blue-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => !readOnly && setTitle(e.target.value)}
              placeholder="Enter a title for your note"
              required
              disabled={readOnly}
              className={`w-full px-4 py-3 border ${readOnly ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 hover:border-blue-400'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ${readOnly ? '' : 'hover:shadow-md transform hover:-translate-y-0.5'}`}
            />
          </div>
          
          <div className="group mt-6">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2 flex items-center group-hover:text-blue-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => !readOnly && setContent(e.target.value)}
              placeholder="Enter your note content (will be encrypted on the blockchain)"
              rows={10}
              disabled={readOnly}
              className={`w-full px-4 py-3 border ${readOnly ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 hover:border-blue-400'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ${readOnly ? '' : 'hover:shadow-md transform hover:-translate-y-0.5'}`}
            />
          </div>
          
          {/* Notification messages */}
          {error && (
            <div className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-200 shadow-sm mt-6 animate-fadeIn">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-red-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 text-green-800 p-4 rounded-lg border border-green-200 shadow-sm mt-6 animate-pulse">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-green-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex justify-end space-x-4 mt-8">
            
              {readOnly ? (
                <>
                  
                </>
              ) : (
                <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
                </button>
              )}

            
            {!readOnly && (
              <button
                type="submit"
                disabled={saving || !account}
                className={`inline-flex items-center px-5 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white ${saving || !account ? 'bg-blue-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'}`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : isNewNote ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create Note
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteEditor;