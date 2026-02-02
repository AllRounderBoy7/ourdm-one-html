import { useState } from 'react';
import { X, Check, Users } from 'lucide-react';
import { Profile } from '../lib/supabase';

interface GroupChatCreatorProps {
  friends: Profile[];
  onClose: () => void;
  onCreate: (name: string, members: string[]) => Promise<void>;
  theme?: 'dark' | 'light';
}

export function GroupChatCreator({ friends, onClose, onCreate, theme = 'dark' }: GroupChatCreatorProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggleMember = (userId: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedMembers(newSet);
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.size === 0) return;

    try {
      setCreating(true);
      await onCreate(groupName, Array.from(selectedMembers));
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-500" />
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Create Group
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
          </button>
        </div>

        {/* Group Name */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Group Name
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name..."
            className={`w-full rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500`}
            maxLength={50}
          />
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {groupName.length}/50 characters
          </p>
        </div>

        {/* Member Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Add Members ({selectedMembers.size} selected)
          </label>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {friends.map((friend) => (
              <div
                key={friend.id}
                onClick={() => toggleMember(friend.id)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedMembers.has(friend.id)
                    ? 'bg-purple-500/20 border-2 border-purple-500'
                    : theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                    {friend.username?.[0]?.toUpperCase() || 'F'}
                  </div>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      @{friend.username}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {friend.full_name}
                    </p>
                  </div>
                </div>
                {selectedMembers.has(friend.id) && (
                  <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 py-3 rounded-lg font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedMembers.size === 0 || creating}
            className="flex-1 py-3 rounded-lg font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating...' : `Create Group`}
          </button>
        </div>
      </div>
    </div>
  );
}
