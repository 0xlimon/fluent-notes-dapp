#![cfg_attr(target_arch = "wasm32", no_std)]
extern crate alloc;
extern crate fluentbase_sdk;

use alloc::string::String;
use alloc::vec::Vec;
use fluentbase_sdk::{
    basic_entrypoint,
    derive::{function_id, router, Contract, solidity_storage},
    Address,
    Bytes,
    U256,
    SharedAPI,
    ContractContextReader,
    BlockContextReader,
};

// Define Note structure
#[derive(Clone)]
struct Note {
    id: U256,
    owner: Address,
    encrypted_content: Bytes,
    timestamp: U256,
    title: String,
}

// Define storage for user data
solidity_storage! {
    // Storage for encryption keys
    mapping(Address => Bytes) UserEncryptionKeys;
    
    // Storage for notes count
    mapping(Address => U256) UserNotesCount;
    
    // Storage map for notes - we'll use multiple mappings for each field
    // Using the pattern noteId => value for each field
    mapping(U256 => U256) NoteId;
    mapping(U256 => Address) NoteOwner;
    mapping(U256 => Bytes) NoteContent;
    mapping(U256 => U256) NoteTimestamp;
    mapping(U256 => String) NoteTitle;
}

// Event signature constants - pre-computed keccak256 hashes
const EVENT_NOTE_CREATED: [u8; 32] = [
    0xa5, 0x63, 0x76, 0x16, 0x0d, 0x28, 0xd2, 0xb9, 0x0a, 0x07, 0x46, 0xc4, 0x9c, 0xab, 0xa7, 0x32,
    0xb4, 0x76, 0x70, 0xe9, 0xd5, 0x1b, 0xc3, 0x9e, 0x43, 0x1f, 0x4a, 0x6d, 0x86, 0x1a, 0x0f, 0x9d
];

const EVENT_NOTE_UPDATED: [u8; 32] = [
    0x9b, 0x87, 0x18, 0x32, 0x9e, 0xe8, 0xd9, 0x34, 0xe3, 0xcb, 0x45, 0xc9, 0x85, 0x18, 0xea, 0x81,
    0xc6, 0xec, 0x5e, 0xa3, 0xb1, 0x1d, 0xd7, 0x7b, 0x32, 0x53, 0xe5, 0x9e, 0x67, 0xc0, 0x5c, 0x8a
];

const EVENT_NOTE_DELETED: [u8; 32] = [
    0x95, 0xa3, 0x23, 0xc3, 0x16, 0x9c, 0xe1, 0xb2, 0x12, 0xd9, 0x54, 0x54, 0xf3, 0x14, 0xa7, 0xef,
    0x7d, 0xd4, 0x8d, 0xc5, 0x74, 0x8b, 0xe2, 0xc6, 0x6b, 0x0a, 0x52, 0xd1, 0x02, 0xf2, 0x80, 0xc4
];

const EVENT_USER_REGISTERED: [u8; 32] = [
    0x87, 0x7a, 0x15, 0x53, 0x68, 0xc1, 0xf0, 0xde, 0x44, 0xcf, 0xba, 0x7a, 0x7d, 0xa9, 0x05, 0xcb,
    0xae, 0xeb, 0x31, 0x94, 0x3d, 0x83, 0x9b, 0x7c, 0x67, 0x10, 0x3a, 0xca, 0xa5, 0x30, 0x09, 0xf5
];


// Helper to emit events with data
fn emit_event<SDK: SharedAPI>(sdk: &mut SDK, event_sig: [u8; 32], data: Bytes, topics: &[fluentbase_sdk::B256]) {
    let mut sig = [0u8; 32];
    sig.copy_from_slice(&event_sig);
    
    // Create a B256 from bytes
    let b256_sig = fluentbase_sdk::B256::from_slice(&sig);
    
    // Create topics array with signature as first topic
    let mut all_topics = Vec::new();
    all_topics.push(b256_sig);
    
    // Add additional topics if provided
    for topic in topics {
        all_topics.push(*topic);
    }
    
    // Emit the event with data and topics
    sdk.emit_log(data, &all_topics);
}


// Store a note
fn store_note<SDK: SharedAPI>(sdk: &mut SDK, _owner: &Address, note_id: &U256, note: &Note) {
    // Store all note data in the mappings from solidity_storage
    
    // Store ID
    NoteId::set(sdk, *note_id, note.id);
    
    // Store owner
    NoteOwner::set(sdk, *note_id, note.owner);
    
    // Store content
    NoteContent::set(sdk, *note_id, note.encrypted_content.clone());
    
    // Store timestamp
    NoteTimestamp::set(sdk, *note_id, note.timestamp);
    
    // Store title
    NoteTitle::set(sdk, *note_id, note.title.clone());
}

// Load a note
fn load_note<SDK: SharedAPI>(sdk: &SDK, owner: &Address, note_id: &U256) -> Option<Note> {
    // First check if the note_id is less than the user's note count
    let count = UserNotesCount::get(sdk, *owner);
    if *note_id >= count {
        return None;
    }
    
    // Get owner of the note to check existence and ownership
    let owner_addr = NoteOwner::get(sdk, *note_id);
    
    // Check if note exists and belongs to the caller
    let zero_address = Address::default();
    if owner_addr == zero_address || owner_addr != *owner {
        return None;
    }
    
    // Load from our mappings which are easier to work with
    let title = NoteTitle::get(sdk, *note_id);
    let content = NoteContent::get(sdk, *note_id);
    let timestamp = NoteTimestamp::get(sdk, *note_id);
    
    Some(Note {
        id: *note_id,
        owner: owner_addr,
        encrypted_content: content,
        timestamp,
        title,
    })
}

// Get all notes for an owner
fn get_all_notes<SDK: SharedAPI>(sdk: &SDK, owner: &Address) -> Vec<Note> {
    let count = UserNotesCount::get(sdk, *owner);
    let count_usize = count.as_limbs()[0] as usize;
    
    let mut notes = Vec::with_capacity(count_usize);
    for i in 0..count_usize {
        let note_id = U256::from(i);
        if let Some(note) = load_note(sdk, owner, &note_id) {
            notes.push(note);
        }
    }
    
    notes
}

#[derive(Contract)]
struct SecureNotes<SDK> {
    sdk: SDK,
}

pub trait SecureNotesAPI {
    // User registration
    fn register_user(&mut self, encryption_key: Bytes);
    
    // Note CRUD operations
    fn create_note(&mut self, title: String, content: String) -> U256;
    fn get_note(&self, note_id: U256) -> (String, String, U256);
    fn update_note(&mut self, note_id: U256, title: String, content: String);
    fn delete_note(&mut self, note_id: U256);
    
    // Note listing
    fn get_note_count(&self) -> U256;
    fn get_notes_list(&self) -> (Vec<U256>, Vec<String>, Vec<U256>);
    
    // Encryption key management
    fn update_encryption_key(&mut self, new_key: Bytes);
    
    // Encryption operations (previously in separate contract)
    fn encrypt_note(&self, content: String) -> Bytes;
    fn decrypt_note(&self, encrypted_content: Bytes) -> String;
    
    // For compatibility with previous Solidity contract
    fn get_encryption_contract_address(&self) -> Address;
}

#[router(mode = "solidity")]
impl<SDK: SharedAPI> SecureNotesAPI for SecureNotes<SDK> {
    #[function_id("registerUser(bytes)")]
    fn register_user(&mut self, encryption_key: Bytes) {
        let caller = self.sdk.context().contract_caller();
        
        // Set the encryption key if provided
        if !encryption_key.is_empty() {
            UserEncryptionKeys::set(&mut self.sdk, caller, encryption_key);
        }
        
        // Create caller address topic for indexed event parameter
        let caller_bytes = caller.to_vec();
        let mut padded_caller = [0u8; 32];
        if caller_bytes.len() >= 20 {
            padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
        }
        let caller_topic = fluentbase_sdk::B256::from(padded_caller);
        
        // Emit registration event
        emit_event(&mut self.sdk, EVENT_USER_REGISTERED, Bytes::new(), &[caller_topic]);
    }
    
    #[function_id("createNote(string,string)")]
    fn create_note(&mut self, title: String, content: String) -> U256 {
        let caller = self.sdk.context().contract_caller();
        
        // Auto-register if not registered
        if UserEncryptionKeys::get(&self.sdk, caller).is_empty() {
            UserEncryptionKeys::set(&mut self.sdk, caller, Bytes::new());
            
            // Create caller address topic for indexed event parameter
            let caller_bytes = caller.to_vec();
            let mut padded_caller = [0u8; 32];
            if caller_bytes.len() >= 20 {
                padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
            }
            let caller_topic = fluentbase_sdk::B256::from(padded_caller);
            
            emit_event(&mut self.sdk, EVENT_USER_REGISTERED, Bytes::new(), &[caller_topic]);
        }
        
        // Encrypt the content
        let encrypted_content = self.encrypt_note(content);
        
        // Get existing notes count
        let count = UserNotesCount::get(&self.sdk, caller);
        let note_id = count;
        
        // Create new note
        let timestamp = U256::from(self.sdk.context().block_timestamp());
        
        let new_note = Note {
            id: note_id,
            owner: caller,
            encrypted_content,
            timestamp,
            title: title.clone(),
        };
        
        // Store the note
        store_note(&mut self.sdk, &caller, &note_id, &new_note);
        
        // Update count
        UserNotesCount::set(&mut self.sdk, caller, count + U256::from(1));
        
        // Create topics for indexed parameters
        let caller_bytes = caller.to_vec();
        let mut padded_caller = [0u8; 32];
        if caller_bytes.len() >= 20 {
            padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
        }
        let caller_topic = fluentbase_sdk::B256::from(padded_caller);
        
        let note_id_bytes = note_id.to_be_bytes::<32>();
        let note_id_topic = fluentbase_sdk::B256::from(note_id_bytes);
        
        // Encode title as event data - create owned bytes to avoid lifetime issues
        let title_data = Bytes::from(title.clone().into_bytes());
        
        // Emit event with indexed parameters and data
        emit_event(&mut self.sdk, EVENT_NOTE_CREATED, title_data, &[caller_topic, note_id_topic]);
        
        note_id
    }
    
    #[function_id("getNote(uint256)")]
    fn get_note(&self, note_id: U256) -> (String, String, U256) {
        let caller = self.sdk.context().contract_caller();
        
        if let Some(note) = load_note(&self.sdk, &caller, &note_id) {
            // Decrypt content
            let decrypted_content = self.decrypt_note(note.encrypted_content.clone());
            
            (note.title.clone(), decrypted_content, note.timestamp)
        } else {
            (String::from(""), String::from("Note does not exist"), U256::from(0))
        }
    }
    
    #[function_id("updateNote(uint256,string,string)")]
    fn update_note(&mut self, note_id: U256, title: String, content: String) {
        let caller = self.sdk.context().contract_caller();
        
        // Auto-register if not registered
        if UserEncryptionKeys::get(&self.sdk, caller).is_empty() {
            UserEncryptionKeys::set(&mut self.sdk, caller, Bytes::new());
            
            // Create caller address topic for indexed event parameter
            let caller_bytes = caller.to_vec();
            let mut padded_caller = [0u8; 32];
            if caller_bytes.len() >= 20 {
                padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
            }
            let caller_topic = fluentbase_sdk::B256::from(padded_caller);
            
            emit_event(&mut self.sdk, EVENT_USER_REGISTERED, Bytes::new(), &[caller_topic]);
        }
        
        // Check if note exists
        if let Some(mut note) = load_note(&self.sdk, &caller, &note_id) {
            // Encrypt the content
            let encrypted_content = self.encrypt_note(content);
            
            // Update the note
            note.encrypted_content = encrypted_content;
            note.title = title;
            note.timestamp = U256::from(self.sdk.context().block_timestamp());
            
            // Save updated note
            store_note(&mut self.sdk, &caller, &note_id, &note);
            
            // Create topics for indexed parameters
            let caller_bytes = caller.to_vec();
            let mut padded_caller = [0u8; 32];
            if caller_bytes.len() >= 20 {
                padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
            }
            let caller_topic = fluentbase_sdk::B256::from(padded_caller);
            
            let note_id_bytes = note_id.to_be_bytes::<32>();
            let note_id_topic = fluentbase_sdk::B256::from(note_id_bytes);
            
            // Emit event
            emit_event(&mut self.sdk, EVENT_NOTE_UPDATED, Bytes::new(), &[caller_topic, note_id_topic]);
        }
    }
    
    #[function_id("deleteNote(uint256)")]
    fn delete_note(&mut self, note_id: U256) {
        let caller = self.sdk.context().contract_caller();
        
        // Auto-register if not registered
        if UserEncryptionKeys::get(&self.sdk, caller).is_empty() {
            UserEncryptionKeys::set(&mut self.sdk, caller, Bytes::new());
            
            // Create caller address topic for indexed event parameter
            let caller_bytes = caller.to_vec();
            let mut padded_caller = [0u8; 32];
            if caller_bytes.len() >= 20 {
                padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
            }
            let caller_topic = fluentbase_sdk::B256::from(padded_caller);
            
            emit_event(&mut self.sdk, EVENT_USER_REGISTERED, Bytes::new(), &[caller_topic]);
        }
        
        // Get notes count
        let count = UserNotesCount::get(&self.sdk, caller);
        
        // Check if note ID is valid and the note exists
        if note_id >= count || load_note(&self.sdk, &caller, &note_id).is_none() {
            return;
        }
        
        // Get last note ID
        let last_id = count - U256::from(1);
        
        if note_id != last_id {
            // Move the last note to the deleted position
            if let Some(last_note) = load_note(&self.sdk, &caller, &last_id) {
                let mut moved_note = last_note.clone();
                moved_note.id = note_id;
                store_note(&mut self.sdk, &caller, &note_id, &moved_note);
            }
        }
        
        // Update count
        UserNotesCount::set(&mut self.sdk, caller, count - U256::from(1));
        
        // Create topics for indexed parameters
        let caller_bytes = caller.to_vec();
        let mut padded_caller = [0u8; 32];
        if caller_bytes.len() >= 20 {
            padded_caller[12..32].copy_from_slice(&caller_bytes[0..20]);
        }
        let caller_topic = fluentbase_sdk::B256::from(padded_caller);
        
        let note_id_bytes = note_id.to_be_bytes::<32>();
        let note_id_topic = fluentbase_sdk::B256::from(note_id_bytes);
        
        // Emit event
        emit_event(&mut self.sdk, EVENT_NOTE_DELETED, Bytes::new(), &[caller_topic, note_id_topic]);
    }
    
    #[function_id("getNoteCount()")]
    fn get_note_count(&self) -> U256 {
        let caller = self.sdk.context().contract_caller();
        UserNotesCount::get(&self.sdk, caller)
    }
    
    #[function_id("getNotesList()")]
    fn get_notes_list(&self) -> (Vec<U256>, Vec<String>, Vec<U256>) {
        let caller = self.sdk.context().contract_caller();
        let notes = get_all_notes(&self.sdk, &caller);
        
        let mut ids = Vec::with_capacity(notes.len());
        let mut titles = Vec::with_capacity(notes.len());
        let mut timestamps = Vec::with_capacity(notes.len());
        
        for note in &notes {
            ids.push(note.id);
            titles.push(note.title.clone());
            timestamps.push(note.timestamp);
        }
        
        (ids, titles, timestamps)
    }
    
    #[function_id("updateEncryptionKey(bytes)")]
    fn update_encryption_key(&mut self, new_key: Bytes) {
        let caller = self.sdk.context().contract_caller();
        UserEncryptionKeys::set(&mut self.sdk, caller, new_key);
    }
    
    #[function_id("encryptNote(string)")]
    fn encrypt_note(&self, content: String) -> Bytes {
        // Get caller address
        let caller = self.sdk.context().contract_caller();
        
        // Get user's encryption key or use default if not set
        let encryption_key = UserEncryptionKeys::get(&self.sdk, caller);
        
        // Convert caller address to a usable form for encryption
        let caller_bytes = caller.to_vec();
        
        // Convert encryption key to a usable form
        let key_bytes = if encryption_key.is_empty() {
            // Default key if user hasn't set one
            caller_bytes.clone()
        } else {
            encryption_key.to_vec()
        };
        
        // Prepare result buffer with room for ownership data and content
        let mut result = Vec::new();
        
        // Add caller address to encrypted data for ownership verification
        result.extend_from_slice(&caller_bytes);
        
        // Simple XOR encryption (for demonstration - would use proper crypto in production)
        for (i, byte) in content.as_bytes().iter().enumerate() {
            // Use key byte as XOR mask, cycling through key bytes
            let key_byte = key_bytes[i % key_bytes.len()];
            result.push(byte ^ key_byte);
        }
        
        Bytes::from(result)
    }

    #[function_id("decryptNote(bytes)")]
    fn decrypt_note(&self, encrypted_content: Bytes) -> String {
        let caller = self.sdk.context().contract_caller();
        let data = encrypted_content.to_vec();
        
        // Validate data format and ownership
        if data.len() < 20 {
            return String::from("Error: Invalid data format");
        }
        
        // Extract the owner address from the encrypted data
        let stored_address = &data[0..20];
        let caller_bytes = caller.to_vec();
        
        if stored_address != caller_bytes.as_slice() {
            return String::from("Error: You don't have permission to decrypt this note");
        }
        
        // Get user's encryption key
        let encryption_key = UserEncryptionKeys::get(&self.sdk, caller);
        let key_bytes = if encryption_key.is_empty() {
            // Default key if user hasn't set one
            caller_bytes
        } else {
            encryption_key.to_vec()
        };
        
        // Decrypt the content (reverse the encryption operation)
        let mut decrypted = Vec::new();
        for (i, byte) in data[20..].iter().enumerate() {
            let key_byte = key_bytes[i % key_bytes.len()];
            decrypted.push(byte ^ key_byte);
        }
        
        // Convert decrypted bytes to string
        match String::from_utf8(decrypted) {
            Ok(s) => s,
            Err(_) => String::from("Error: Decryption failed"),
        }
    }
    
    // For compatibility with previous architecture where there were two contracts
    #[function_id("getEncryptionContractAddress()")]
    fn get_encryption_contract_address(&self) -> Address {
        // Return this contract's address since all functionality is now here
        self.sdk.context().contract_address()
    }
}

impl<SDK: SharedAPI> SecureNotes<SDK> {
    // Deployment logic
    fn deploy(&self) {
        // Nothing special needed for deployment
    }
}

// Define entry point for the contract
basic_entrypoint!(SecureNotes);

#[cfg(test)]
mod tests {
    use super::*;
    use fluentbase_sdk::{address, testing::TestingContext, ContractContextV1};

    #[test]
    fn test_note_operations() {
        // Set up test context
        let test_address = address!("f39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
        let test_title = "Test Note";
        let test_content = "This is a test note content";
        
        let sdk = TestingContext::default().with_contract_context(ContractContextV1 {
            caller: test_address,
            ..Default::default()
        });
        
        let mut notes = SecureNotes { sdk: sdk.clone() };
        
        // Test creating a note
        let note_id = notes.create_note(test_title.to_string(), test_content.to_string());
        
        // Test getting note count
        let count = notes.get_note_count();
        assert_eq!(count, U256::from(1));
        
        // Test getting note
        let (title, content, _) = notes.get_note(note_id);
        assert_eq!(title, test_title);
        assert_eq!(content, test_content);
        
        // Test updating note
        let updated_title = "Updated Test Note";
        let updated_content = "This is the updated content";
        notes.update_note(note_id, updated_title.to_string(), updated_content.to_string());
        
        // Verify update
        let (title, content, _) = notes.get_note(note_id);
        assert_eq!(title, updated_title);
        assert_eq!(content, updated_content);
        
        // Test getting notes list
        let (ids, titles, _) = notes.get_notes_list();
        assert_eq!(ids.len(), 1);
        assert_eq!(titles.len(), 1);
        assert_eq!(titles[0], updated_title);
        
        // Test deleting note
        notes.delete_note(note_id);
        
        // Verify deletion
        let count = notes.get_note_count();
        assert_eq!(count, U256::from(0));
    }
}