import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { SecureNotesABI } from '../contracts/abis';

/**
 * NotesList component displays all user notes and allows selection
 * @param {Object} props - Component props
 * @param {string} props.contractAddress - Address of the SecureNotes contract
 * @param {Object} props.provider - Ethers provider
 * @param {string} props.account - Connected wallet address 
 * @param {Function} props.onSelectNote - Callback when a note is selected
 * @param {Function} props.onCreateNote - Callback when create note button is clicked
 * @param {boolean} props.isRegistered - Whether the user is registered
 * @param {number} props.refreshTrigger - Value that changes to trigger a refresh
 */
const NotesList = ({ contractAddress, provider, account, onSelectNote, onCreateNote, isRegistered, refreshTrigger }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  // Format a timestamp to a readable date
  const formatDate = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Fetch notes from blockchain
  const fetchNotes = useCallback(async () => {
    // Don't proceed if parameters are missing
    if (!provider || !account || !contractAddress) {
      setNotes([]);
      setLoading(false);
      setError('Wallet not connected or contract not available.');
      return;
    }

    // Set loading state
    setLoading(true);
    setError('');

    try {
      // Create contract instance
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        SecureNotesABI,
        signer
      );
      
      // Get notes list
      const [ids, titles, timestamps] = await contract.getNotesList({
        gasLimit: 500000
      });
      
      // Format notes data
      const formattedNotes = ids.map((id, index) => ({
        id: Number(id),
        title: titles[index] || "Untitled Note",
        timestamp: Number(timestamps[index]),
        formattedDate: formatDate(Number(timestamps[index]) * 1000)
      }));
      
      // Sort by timestamp (newest first)
      formattedNotes.sort((a, b) => b.timestamp - a.timestamp);
      
      // Update state
      setNotes(formattedNotes);
      setError('');
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError('Failed to load notes. Please try refreshing.');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [provider, account, contractAddress, formatDate]);

  // Initial fetch on mount
  useEffect(() => {
    if (provider && account && contractAddress) {
      fetchNotes();
    }
  }, [provider, account, contractAddress, fetchNotes]);

  // Fetch when refreshTrigger changes (after note creation or edit)
  useEffect(() => {
    if (refreshTrigger && provider && account && contractAddress) {
      fetchNotes();
    }
  }, [refreshTrigger, provider, account, contractAddress, fetchNotes]);

  // Handle manual refresh
  const handleRefresh = () => {
    setError('');
    fetchNotes();
  };

  // Handle note selection
  const handleSelectNote = (noteId) => {
    setSelectedNoteId(noteId);
    if (onSelectNote) {
      onSelectNote(noteId);
    }
  };

  // Handle create note button click
  const handleCreateNote = () => {
    if (onCreateNote) {
      onCreateNote();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center">
          <div className="flex flex-col">
            <h2 className="font-semibold text-lg text-gray-800">Your Notes</h2>
            <p className="text-xs text-gray-500">{notes.length > 0 ? `${notes.length} note${notes.length !== 1 ? 's' : ''}` : 'No notes yet'}</p>
          </div>
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="ml-3 p-2 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 flex items-center justify-center"
            title="Refresh notes list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCreateNote}
            disabled={!account}
            title={!account 
              ? "Connect wallet first" 
              : "Create a new note"
            }
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium shadow-sm ${
              account
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transform hover:-translate-y-0.5 transition-all duration-200' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            } transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Note
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center p-8">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute top-0 w-16 h-16 animate-pulse rounded-full bg-blue-100 opacity-75"></div>
            <div className="absolute top-3 left-3 w-10 h-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </div>
          <p className="text-base text-gray-700 font-medium">Loading notes...</p>
          <p className="text-xs text-gray-500 max-w-xs text-center mt-2">
            This may take a moment as we retrieve your encrypted notes from the blockchain
          </p>
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Notes</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-3">
                  <button
                    onClick={handleRefresh}
                    className="inline-flex items-center text-sm font-medium text-red-700 hover:text-red-600 bg-red-100 hover:bg-red-200 py-1.5 px-3 rounded-md transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Make sure your wallet is connected to the Fluent network.
          </p>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="rounded-full bg-blue-50 p-4 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14 text-blue-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">No Notes Yet</h3>
          <p className="text-gray-500 text-center mb-4">Create your first encrypted note to get started!</p>
          {account && (
            <button
              onClick={handleCreateNote}
              className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Note
            </button>
          )}
        </div>
      ) : (
        <ul className="flex-1 overflow-auto divide-y divide-gray-100">
          {notes.map((note) => (
            <li key={note.id} className="transition-all duration-200">
              <button
                onClick={() => handleSelectNote(note.id)}
                className={`w-full text-left px-5 py-4 transition-all duration-200 ${
                  selectedNoteId === note.id 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'hover:bg-gray-50 border-l-4 border-transparent hover:border-blue-300'
                }`}
              >
                <div className="flex items-center">
                  <div className="flex-1 min-w-0">
                    <p className={`${selectedNoteId === note.id ? 'font-semibold text-blue-700' : 'font-medium text-gray-900'} text-sm truncate`}>
                      {note.title || 'Untitled Note'}
                    </p>
                    <div className="flex items-center mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-gray-500">{note.formattedDate}</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${selectedNoteId === note.id ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotesList;