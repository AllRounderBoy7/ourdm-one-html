import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, X, Camera, Type, Image, Send, Heart, 
  MessageCircle, Eye, ChevronLeft, ChevronRight,
  Pause, Play, Volume2, VolumeX, MoreVertical, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Story {
  id: string;
  user_id: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'text';
  text_content?: string;
  gradient?: string;
  created_at: string;
  expires_at: string;
  view_count: number;
  user?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface StoryGroup {
  user: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

const GRADIENTS = [
  'from-purple-600 via-pink-500 to-red-500',
  'from-blue-600 via-cyan-500 to-teal-400',
  'from-green-500 via-emerald-500 to-teal-500',
  'from-orange-500 via-red-500 to-pink-500',
  'from-indigo-600 via-purple-500 to-pink-500',
  'from-yellow-400 via-orange-500 to-red-500',
  'from-gray-700 via-gray-800 to-black',
  'from-pink-500 via-purple-500 to-indigo-500',
];

export default function StoriesPage() {
  const { user, profile } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'photo' | 'text' | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchStories();
  }, [user]);

  const fetchStories = async () => {
    if (!user) return;
    
    try {
      // Fetch my stories
      const { data: myData } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (myData) setMyStories(myData);

      // Fetch friends' stories
      const { data: friends } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friends) {
        const friendIds = friends.map(f => 
          f.user_id === user.id ? f.friend_id : f.user_id
        );

        const { data: stories } = await supabase
          .from('stories')
          .select(`
            *,
            user:profiles!user_id(id, username, full_name, avatar_url)
          `)
          .in('user_id', friendIds)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (stories) {
          // Group stories by user
          const groups: { [key: string]: StoryGroup } = {};
          stories.forEach(story => {
            if (!story.user) return;
            if (!groups[story.user_id]) {
              groups[story.user_id] = {
                user: story.user,
                stories: [],
                hasUnviewed: false,
              };
            }
            groups[story.user_id].stories.push(story);
          });
          setStoryGroups(Object.values(groups));
        }
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCreatorMode('photo');
    }
  };

  const postStory = async () => {
    if (!user) return;
    setUploading(true);

    try {
      let mediaUrl = null;
      let mediaType: 'image' | 'video' | 'text' = 'text';

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('stories')
          .upload(fileName, selectedFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('stories')
            .getPublicUrl(fileName);
          
          mediaUrl = publicUrl;
          mediaType = selectedFile.type.startsWith('video') ? 'video' : 'image';
        }
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await supabase.from('stories').insert({
        user_id: user.id,
        media_url: mediaUrl,
        media_type: creatorMode === 'text' ? 'text' : mediaType,
        text_content: creatorMode === 'text' ? textContent : null,
        gradient: creatorMode === 'text' ? GRADIENTS[selectedGradient] : null,
        expires_at: expiresAt.toISOString(),
      });

      // Reset and close
      setSelectedFile(null);
      setPreviewUrl(null);
      setTextContent('');
      setShowCreator(false);
      setCreatorMode(null);
      fetchStories();
    } catch (error) {
      console.error('Error posting story:', error);
    } finally {
      setUploading(false);
    }
  };

  const openStoryViewer = (groupIndex: number, storyIndex: number = 0) => {
    setCurrentGroupIndex(groupIndex);
    setCurrentStoryIndex(storyIndex);
    setShowViewer(true);
    setProgress(0);
    startProgress();
  };

  const startProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    
    setProgress(0);
    progressRef.current = setInterval(() => {
      if (!isPaused) {
        setProgress(prev => {
          if (prev >= 100) {
            nextStory();
            return 0;
          }
          return prev + 2;
        });
      }
    }, 100);
  };

  const nextStory = () => {
    const currentGroup = storyGroups[currentGroupIndex];
    if (!currentGroup) return;

    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (currentGroupIndex < storyGroups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
      setProgress(0);
    } else {
      closeViewer();
    }
  };

  const prevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
      const prevGroup = storyGroups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    }
  };

  const closeViewer = () => {
    setShowViewer(false);
    if (progressRef.current) clearInterval(progressRef.current);
  };

  const deleteStory = async (storyId: string) => {
    await supabase.from('stories').delete().eq('id', storyId);
    fetchStories();
  };

  const fetchComments = async (storyId: string) => {
    const { data } = await supabase
      .from('story_comments')
      .select(`
        *,
        user:profiles!user_id(username, full_name, avatar_url)
      `)
      .eq('story_id', storyId)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data);
  };

  const sendComment = async () => {
    if (!comment.trim() || !user) return;
    
    const currentGroup = storyGroups[currentGroupIndex];
    const currentStory = currentGroup?.stories[currentStoryIndex];
    if (!currentStory) return;

    await supabase.from('story_comments').insert({
      story_id: currentStory.id,
      user_id: user.id,
      content: comment,
    });

    setComment('');
    fetchComments(currentStory.id);
  };

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];

  return (
    <div className="min-h-screen bg-black dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Stories</h1>
          <button
            onClick={() => setShowCreator(true)}
            className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* My Story */}
        <div className="mb-6">
          <h2 className="text-white/70 text-sm font-medium mb-3">Your Story</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreator(true)}
              className="flex flex-col items-center"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 
                              flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="You"
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xl font-bold">
                      {profile?.full_name?.charAt(0) || 'Y'}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-600 
                              flex items-center justify-center border-2 border-black">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <span className="text-white text-xs mt-2">Add Story</span>
            </button>

            {/* My posted stories */}
            {myStories.map((story, index) => (
              <button
                key={story.id}
                onClick={() => {
                  // View own stories
                }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 p-0.5">
                  <div className="w-full h-full rounded-full overflow-hidden bg-black">
                    {story.media_type === 'text' ? (
                      <div className={`w-full h-full bg-gradient-to-br ${story.gradient} 
                                    flex items-center justify-center p-1`}>
                        <span className="text-white text-[6px] text-center line-clamp-3">
                          {story.text_content}
                        </span>
                      </div>
                    ) : (
                      <img 
                        src={story.media_url!} 
                        alt="Story"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Eye className="w-3 h-3 text-white/50" />
                  <span className="text-white/50 text-xs">{story.view_count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Friends' Stories */}
        {storyGroups.length > 0 && (
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3">Recent Updates</h2>
            <div className="grid grid-cols-2 gap-3">
              {storyGroups.map((group, groupIndex) => (
                <motion.button
                  key={group.user.id}
                  onClick={() => openStoryViewer(groupIndex)}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-800"
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Story preview */}
                  {group.stories[0].media_type === 'text' ? (
                    <div className={`w-full h-full bg-gradient-to-br ${group.stories[0].gradient}`}>
                      <p className="text-white text-sm p-4 line-clamp-4">
                        {group.stories[0].text_content}
                      </p>
                    </div>
                  ) : (
                    <img 
                      src={group.stories[0].media_url!}
                      alt={group.user.full_name}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                  {/* User info */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-full p-0.5 ${
                      group.hasUnviewed 
                        ? 'bg-gradient-to-br from-purple-600 to-pink-600' 
                        : 'bg-gray-600'
                    }`}>
                      {group.user.avatar_url ? (
                        <img 
                          src={group.user.avatar_url}
                          alt={group.user.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {group.user.full_name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name and count */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white font-medium text-sm truncate">
                      {group.user.full_name}
                    </p>
                    <p className="text-white/50 text-xs">
                      {group.stories.length} {group.stories.length === 1 ? 'story' : 'stories'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && storyGroups.length === 0 && myStories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-purple-600/20 flex items-center justify-center mb-4">
              <Camera className="w-12 h-12 text-purple-400" />
            </div>
            <h3 className="text-white text-lg font-medium mb-2">No Stories Yet</h3>
            <p className="text-white/50 text-center mb-6">
              Share moments with your friends!
            </p>
            <button
              onClick={() => setShowCreator(true)}
              className="px-6 py-3 bg-purple-600 rounded-full text-white font-medium"
            >
              Create Story
            </button>
          </div>
        )}
      </div>

      {/* Story Creator Modal */}
      <AnimatePresence>
        {showCreator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowCreator(false);
                setCreatorMode(null);
                setSelectedFile(null);
                setPreviewUrl(null);
                setTextContent('');
              }}
              className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/20"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {!creatorMode ? (
              /* Mode selection */
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <h2 className="text-white text-2xl font-bold mb-8">Create Story</h2>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-40 h-40 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 
                           flex flex-col items-center justify-center gap-3"
                >
                  <Camera className="w-12 h-12 text-white" />
                  <span className="text-white font-medium">Photo/Video</span>
                </button>

                <button
                  onClick={() => setCreatorMode('text')}
                  className="w-40 h-40 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 
                           flex flex-col items-center justify-center gap-3"
                >
                  <Type className="w-12 h-12 text-white" />
                  <span className="text-white font-medium">Text</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : creatorMode === 'photo' && previewUrl ? (
              /* Photo/Video preview */
              <div className="h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center bg-black">
                  {selectedFile?.type.startsWith('video') ? (
                    <video 
                      src={previewUrl}
                      className="max-w-full max-h-full"
                      controls
                    />
                  ) : (
                    <img 
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>

                <div className="p-4 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setCreatorMode(null);
                    }}
                    className="px-6 py-3 rounded-full bg-white/20 text-white"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={postStory}
                    disabled={uploading}
                    className="px-6 py-3 rounded-full bg-purple-600 text-white flex items-center gap-2"
                  >
                    {uploading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : creatorMode === 'text' ? (
              /* Text story creator */
              <div className={`h-full flex flex-col bg-gradient-to-br ${GRADIENTS[selectedGradient]}`}>
                <div className="flex-1 flex items-center justify-center p-8">
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Type your story..."
                    className="w-full text-center text-2xl font-bold text-white bg-transparent 
                             resize-none outline-none placeholder-white/50"
                    style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
                    rows={5}
                    maxLength={280}
                    autoFocus
                  />
                </div>

                {/* Gradient picker */}
                <div className="px-4 pb-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                    {GRADIENTS.map((gradient, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedGradient(index)}
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0
                                  ${selectedGradient === index ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setCreatorMode(null);
                        setTextContent('');
                      }}
                      className="px-6 py-3 rounded-full bg-white/20 text-white"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={postStory}
                      disabled={uploading || !textContent.trim()}
                      className="px-6 py-3 rounded-full bg-white text-black font-medium 
                               flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Post
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {showViewer && currentStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
            onClick={(e) => {
              // Tap left/right for prev/next
              const x = (e as any).clientX;
              const width = window.innerWidth;
              if (x < width / 3) prevStory();
              else if (x > (width * 2) / 3) nextStory();
            }}
          >
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
              {currentGroup.stories.map((_, index) => (
                <div 
                  key={index}
                  className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
                >
                  <motion.div
                    className="h-full bg-white"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: index < currentStoryIndex 
                        ? '100%' 
                        : index === currentStoryIndex 
                          ? `${progress}%` 
                          : '0%'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                  {currentGroup.user.avatar_url ? (
                    <img 
                      src={currentGroup.user.avatar_url}
                      alt={currentGroup.user.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {currentGroup.user.full_name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {currentGroup.user.full_name}
                  </p>
                  <p className="text-white/50 text-xs">
                    {new Date(currentStory.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(!isPaused);
                  }}
                  className="p-2 rounded-full bg-white/20"
                >
                  {isPaused ? (
                    <Play className="w-5 h-5 text-white" />
                  ) : (
                    <Pause className="w-5 h-5 text-white" />
                  )}
                </button>

                {currentStory.media_type === 'video' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    className="p-2 rounded-full bg-white/20"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeViewer();
                  }}
                  className="p-2 rounded-full bg-white/20"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Story content */}
            <div className="h-full flex items-center justify-center">
              {currentStory.media_type === 'text' ? (
                <div className={`w-full h-full bg-gradient-to-br ${currentStory.gradient} 
                              flex items-center justify-center p-8`}>
                  <p className="text-white text-2xl font-bold text-center"
                     style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    {currentStory.text_content}
                  </p>
                </div>
              ) : currentStory.media_type === 'video' ? (
                <video
                  ref={videoRef}
                  src={currentStory.media_url!}
                  className="max-w-full max-h-full object-contain"
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                />
              ) : (
                <img
                  src={currentStory.media_url!}
                  alt="Story"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            {/* Reply input */}
            <div className="absolute bottom-6 left-4 right-4 z-20 flex items-center gap-3">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Send a message..."
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-4 py-3 rounded-full bg-white/10 text-white placeholder-white/50 
                         border border-white/20 outline-none focus:border-white/40"
              />
              
              {comment && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    sendComment();
                  }}
                  className="p-3 rounded-full bg-purple-600"
                >
                  <Send className="w-5 h-5 text-white" />
                </motion.button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // React with heart
                }}
                className="p-3 rounded-full bg-white/10"
              >
                <Heart className="w-5 h-5 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
