/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Settings, 
  Zap, 
  FileText, 
  ShieldAlert, 
  RefreshCw, 
  Terminal, 
  Activity,
  Trash2,
  Play,
  Square,
  ChevronRight,
  ChevronDown,
  User,
  Quote,
  Hash,
  MessageSquare,
  Music,
  SkipForward,
  Pause,
  Repeat,
  SkipBack,
  Search,
  RotateCcw,
  Shuffle,
  Shield,
  Upload,
  Calendar,
  Link,
  Clock,
  Server,
  Users,
  Trash,
  Volume2,
  VolumeX,
  Copy,
  Download,
  ExternalLink,
  Check,
  Image as ImageIcon,
  CheckSquare,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SONGS } from './songs';
import { 
  TabType, 
  DiscordUser, 
  DiscordGuild,
  DiscordChannel,
  DiscordRelationship,
  STARTERS, 
  MODIFIERS, 
  DESCRIPTORS, 
  NOUNS, 
  VERBS, 
  INTENSIFIERS, 
  TAUNTS, 
  EXTRAS, 
  CLOSERS 
} from './types';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

type NavItem = { id: TabType; label: string; icon: any };
type NavCategory = { id: string; label: string; icon: any; items: NavItem[] };

const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'beefing',
    label: 'Beefing',
    icon: ShieldAlert,
    items: [
      { id: 'normal', label: 'Normal Typing', icon: MessageSquare },
      { id: 'autobeefer', label: 'AutoBeefer', icon: Activity },
      { id: 'legit', label: 'Legit Beefer', icon: ShieldAlert },
      { id: 'robber', label: 'Robber', icon: Search },
    ],
  },
  {
    id: 'server',
    label: 'Server',
    icon: Server,
    items: [
      { id: 'channels', label: 'Channels', icon: Hash },
      { id: 'mass-dm', label: 'Mass DM', icon: Users },
      { id: 'force-nickname', label: 'Force Nickname', icon: User },
      { id: 'gc-changer', label: 'GC Changer', icon: RefreshCw },
      { id: 'wl-gen', label: 'WL Generator', icon: Zap },
    ],
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: MessageSquare,
    items: [
      { id: 'auto-reply', label: 'Auto Reply', icon: MessageSquare },
      { id: 'anti-afk', label: 'Anti AFK', icon: Shield },
      { id: 'afk-check', label: 'AFK Check', icon: Activity },
      { id: 'delete-messages', label: 'Delete Messages', icon: Trash2 },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    items: [
      { id: 'about-me', label: 'About Me', icon: User },
      { id: 'song', label: 'Song', icon: Music },
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    icon: Settings,
    items: [
      { id: 'options', label: 'Options', icon: Settings },
    ],
  },
];

// Error Boundary Component
class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Iframe/Player Error:", error, errorInfo);
  }

  render() {
    if (this.state && this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// A token copied from a client, a browser devtools pane or a notes app usually
// arrives wrapped in something: a trailing newline, quotes, an "Authorization:"
// label, a "Bot"/"Bearer" prefix, or a whole email:password:token line. Discord
// answers every one of those with a 401, which reads to the user as a rejected
// token, so the value is cleaned once, at the point it enters the app.
const looksLikeDiscordToken = (value: string) =>
  /^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/.test(value) || /^mfa\.[\w-]{20,}$/.test(value);

const normalizeDiscordToken = (raw: string): string => {
  let value = (raw || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!value) return '';
  value = value.replace(/^authorization\s*:\s*/i, '').trim();
  value = value.replace(/^(bot|bearer)\s+/i, '').trim();
  value = value.replace(/^["'`<>]+/, '').replace(/["'`<>]+$/, '').trim();
  if (value.includes('@') && value.includes(':')) {
    const parts = value.split(':');
    const candidate = (parts[parts.length - 1] || '').trim();
    if (parts.length > 1 && looksLikeDiscordToken(candidate)) value = candidate;
  }
  return value;
};

// Discord API request dispatcher: Proxies through /api/discord/* in browser to bypass CORS restrictions
// ensuring pure web/HTML execution with zero need for external .exe, desktop daemons, or key systems.
const discordFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  let targetUrl = url;
  if (url.startsWith('https://discord.com/api/v9/')) {
    targetUrl = url.replace('https://discord.com/api/v9/', '/api/discord/');
  } else if (url.startsWith('https://discord.com/api/v9')) {
    targetUrl = url.replace('https://discord.com/api/v9', '/api/discord');
  }

  let requestInit = init;
  if (init.headers) {
    const headers = new Headers(init.headers as HeadersInit);
    const sent = headers.get('Authorization');
    if (sent) {
      const cleaned = normalizeDiscordToken(sent);
      if (cleaned !== sent) {
        headers.set('Authorization', cleaned);
        requestInit = { ...init, headers };
      }
    }
  }

  try {
    const res = await fetch(targetUrl, requestInit);
    if (targetUrl !== url) {
      // Discord always answers JSON, so an HTML body or a failed status came from the
      // host or its CDN rather than from Discord: a 404/502 on the proxy itself, or an
      // edge block page when the host's shared IP is throttled. Those must never be
      // reported as a bad token, so the same call is retried straight from the browser
      // on the reader's own connection, and only its answer is believed.
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        try {
          return await fetch(url, requestInit);
        } catch {
          return res;
        }
      }
    }
    return res;
  } catch {
    if (targetUrl !== url) {
      return await fetch(url, requestInit);
    }
    throw new Error('Network error during Discord API request');
  }
};

export function CordApp() {
  // Refs
  const playerRef = useRef<any>(null);
  const gcIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autobeeferIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const forceNickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const forceNickLastNameRef = useRef('');
  const forceOtherIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTriggerTime = useRef(0);
  const lastTypingIndicatorTime = useRef(0);
  const autoReplyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoReplyHandledIds = useRef(new Set<string>());
  const autoReplyBaselineIdRef = useRef('');
  const autoReplyRecentPoolRef = useRef<number[]>([]);
  const lastRepliedMsgIdRef = useRef('');
  const afkCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const afkCheckCounterRef = useRef(0);
  const antiAfkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const antiAfkReplyIndexRef = useRef(0);
  const seenIds = useRef(new Set<string>());
  const antiAfkPendingIds = useRef(new Set<string>());
  const deleteProgressRef = useRef<HTMLDivElement>(null);
  const deleteLogRef = useRef<string[]>([]);

  // Scoped fetch to route all Discord API calls through proxy without CORS or native exe
  const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    if (urlStr.startsWith('https://discord.com/api/v9')) {
      return discordFetch(urlStr, init);
    }
    return window.fetch(input, init);
  };

  // Global State
  const [hasEntered, setHasEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const toggleCategory = useCallback((id: string) => {
    setCollapsedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [token, setToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<
    'idle' | 'checking' | 'connected' | 'rejected' | 'session-expired' | 'unavailable'
  >('idle');
  const [channelId, setChannelId] = useState('');
  const [userId, setUserId] = useState('');
  const [currentUser, setCurrentUser] = useState<DiscordUser | null>(null);
  const [showWelcomeNotif, setShowWelcomeNotif] = useState(false);
  const [showSongNotif, setShowSongNotif] = useState(false);
  const [message, setMessage] = useState('');
  const [userPing, setUserPing] = useState('');
  const [textCase, setTextCase] = useState<'none' | 'upper' | 'lower'>('none');
  const [autoQuoteEnabled, setAutoQuoteEnabled] = useState(false);
  const [quoteUserId, setQuoteUserId] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [lastQuotedMessage, setLastQuotedMessage] = useState('');
  const [startMsg, setStartMsg] = useState('');
  const [endMsg, setEndMsg] = useState('');
  const [randomEffects, setRandomEffects] = useState(false);
  const [gcId, setGcId] = useState('');
  const [gcNewName, setGcNewName] = useState('');
  const [gcStatus, setGcStatus] = useState('');
  const [gcLoop, setGcLoop] = useState(false);
  const [gcCurrentIndex, setGcCurrentIndex] = useState(0);
  const [gcCountdown, setGcCountdown] = useState(false);
  const [gcCountdownStart, setGcCountdownStart] = useState(10);
  const [gcDelay, setGcDelay] = useState(1.0);
  const [wlAmount, setWlAmount] = useState(50);
  const [wlOutput, setWlOutput] = useState('');
  const [wlStatus, setWlStatus] = useState('');
  const [autobeeferMessages, setAutobeeferMessages] = useState<string[]>([]);
  const [autobeeferActive, setAutobeeferActive] = useState(false);
  const [delay, setDelay] = useState(0.1);
  const [autoBold, setAutoBold] = useState(false);
  const [boldChance, setBoldChance] = useState(20);
  const [ladderMode, setLadderMode] = useState(false);
  const [ladderChance, setLadderChance] = useState(20);
  const [autobeeferCase, setAutobeeferCase] = useState<'none' | 'upper' | 'lower'>('none');
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());
  const [legitEnabled, setLegitEnabled] = useState(false);
  const [legitMessages, setLegitMessages] = useState<string[]>([]);
  const [triggerKey, setTriggerKey] = useState('Delete');
  const [mps, setMps] = useState(1.0);
  const [legitCase, setLegitCase] = useState<'none' | 'upper' | 'lower'>('none');
  const [randomizeLegit, setRandomizeLegit] = useState(false);
  const [currentLegitIndex, setCurrentLegitIndex] = useState(0);
  const [forceNickActive, setForceNickActive] = useState(false);
  const [forceNickName, setForceNickName] = useState('');
  const [forceNickGuildId, setForceNickGuildId] = useState('');
  const [forceNickGuildName, setForceNickGuildName] = useState('');
  const [forceNickStatus, setForceNickStatus] = useState('');
  const [forceOtherActive, setForceOtherActive] = useState(false);
  const [forceOtherUserId, setForceOtherUserId] = useState('');
  const [forceOtherNickName, setForceOtherNickName] = useState('');
  const [forceOtherGuildId, setForceOtherGuildId] = useState('');
  const [forceOtherGuildName, setForceOtherGuildName] = useState('');
  const [forceOtherStatus, setForceOtherStatus] = useState('');
  const [aboutMeProfile, setAboutMeProfile] = useState<any>(null);
  const [aboutMeLoading, setAboutMeLoading] = useState(false);
  const [autoReact, setAutoReact] = useState(false);
  const [reactionEmoji, setReactionEmoji] = useState('☠️');
  const [syncLists, setSyncLists] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [mentionTarget, setMentionTarget] = useState(true);
  const [autoReplyActive, setAutoReplyActive] = useState(false);
  const [autoReplyCustomName, setAutoReplyCustomName] = useState('');
  const [autoReplyIntroEnabled, setAutoReplyIntroEnabled] = useState(false);
  const [autoReplyCase, setAutoReplyCase] = useState<'none' | 'upper' | 'lower' | 'ladder'>('none');
  const [autoReplyCustomMessages, setAutoReplyCustomMessages] = useState('');
  const [autoReplyDelay, setAutoReplyDelay] = useState(1.0);
  const [lastRepliedMsgId, setLastRepliedMsgId] = useState('');
  const [autoReplyMessages, setAutoReplyMessages] = useState<string[]>([]);
  const [currentAutoReplyIndex, setCurrentAutoReplyIndex] = useState(0);
  const [afkCheckActive, setAfkCheckActive] = useState(false);
  const [afkCheckValue, setAfkCheckValue] = useState(10);
  const [afkCheckCurrent, setAfkCheckCurrent] = useState(0);
  const [antiAfkActive, setAntiAfkActive] = useState(false);
  const [antiAfkDelay, setAntiAfkDelay] = useState(0.5);
  const [antiAfkUseDefault, setAntiAfkUseDefault] = useState(true);
  const [antiAfkCustomMessages, setAntiAfkCustomMessages] = useState('');
  const [antiAfkStatus, setAntiAfkStatus] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'paused'>('idle');
  const [deleteMode, setDeleteMode] = useState<'count' | 'link' | 'date' | 'all' | 'keyword' | 'range'>('count');
  const [deleteCount, setDeleteCount] = useState(100);
  const [deleteKeyword, setDeleteKeyword] = useState('');
  const [deleteTargetUserId, setDeleteTargetUserId] = useState('');
  const [deleteOnlyAttachments, setDeleteOnlyAttachments] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [deleteLink, setDeleteLink] = useState('');
  const [deleteDate, setDeleteDate] = useState('');
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [deleteLogs, setDeleteLogs] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string; type: 'dm' | 'channel' | 'none' }>({ id: '', name: 'None', type: 'none' });
  const [dms, setDms] = useState<any[]>([]);
  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [selectedGuildChannels, setSelectedGuildChannels] = useState<any[]>([]);
  const [dmSearch, setDmSearch] = useState('');
  const [guildSearch, setGuildSearch] = useState('');
  const [isRefreshingDms, setIsRefreshingDms] = useState(false);
  const [isRefreshingGuilds, setIsRefreshingGuilds] = useState(false);

  // Robber State
  const [robberTargetId, setRobberTargetId] = useState('');
  const [robberGuildId, setRobberGuildId] = useState('');
  const [robberStatus, setRobberStatus] = useState('');
  const [robberResult, setRobberResult] = useState<any>(null);
  const [isRobbing, setIsRobbing] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [robberFoundCandidates, setRobberFoundCandidates] = useState<any[]>([]);
  const [robberAssetTab, setRobberAssetTab] = useState<'global' | 'server'>('global');

  // Mass DM State
  const [friends, setFriends] = useState<DiscordRelationship[]>([]);
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  const [massDmSearch, setMassDmSearch] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [massDmMessage, setMassDmMessage] = useState('');
  const [massDmImageFile, setMassDmImageFile] = useState<File | null>(null);
  const [massDmImagePreview, setMassDmImagePreview] = useState<string | null>(null);
  const [massDmDelay, setMassDmDelay] = useState(3.0);
  const [massDmTypingIndicator, setMassDmTypingIndicator] = useState(true);
  const [massDmActive, setMassDmActive] = useState(false);
  const [massDmStatus, setMassDmStatus] = useState('');
  const [massDmProgress, setMassDmProgress] = useState({ current: 0, total: 0, sent: 0, failed: 0 });
  const [massDmLogs, setMassDmLogs] = useState<Array<{ msg: string; type: 'info' | 'success' | 'warn' | 'error'; time: string }>>([]);
  const massDmStoppedRef = useRef(false);

  // Deletion State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLog, setDeleteLog] = useState<any[]>([]);
  const [deleteStartLink, setDeleteStartLink] = useState('');
  const [deleteEndLink, setDeleteEndLink] = useState('');
  const [deleteStartDate, setDeleteStartDate] = useState('');
  const [deleteEndDate, setDeleteEndDate] = useState('');
  const [deleteIncludePinned, setDeleteIncludePinned] = useState(false);
  const [deleteDelay, setDeleteDelay] = useState(1.0);
  const [autoRefreshDelete, setAutoRefreshDelete] = useState(false);
  const [autoRefreshDeleteInterval, setAutoRefreshDeleteInterval] = useState(30);
  const deletionStoppedRef = useRef(false);

  // Anti AFK State
  const [antiAfkGuildId, setAntiAfkGuildId] = useState('');

  // AFK Check State
  const [afkCheckDelay, setAfkCheckDelay] = useState(1.0);

  // Song State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searchPlacement, setSearchPlacement] = useState<'header' | 'module'>('module');
  const [songQueue, setSongQueue] = useState<any[]>(SONGS);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [queueFilter, setQueueFilter] = useState('');
  const [songProgress, setSongProgress] = useState(0);
  const [songCurrentTime, setSongCurrentTime] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);
  const [loopMode, setLoopMode] = useState(false);
  const loopModeRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);

  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef(false);
  const pendingPlayRef = useRef(false);

  const addDeleteLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setDeleteLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 100));
  };

  // YouTube IFrame API Initialization
  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };

    const initPlayer = () => {
      if (ytPlayerRef.current) return;
      if (typeof window === 'undefined' || !window.YT || !window.YT.Player) return;
      const el = document.getElementById('youtube-player-api');
      if (!el) return;
      
      try {
        const initialId = SONGS[0]?.id || 'ijHvVG20DNg';
        ytPlayerRef.current = new window.YT.Player('youtube-player-api', {
          height: '100%',
          width: '100%',
          videoId: initialId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            cc_load_policy: 0,
            cc_lang_pref: 'none'
          },
          events: {
            onReady: (event: any) => {
              ytPlayerReadyRef.current = true;
              try {
                if (event.target && typeof event.target.unloadModule === 'function') {
                  event.target.unloadModule('captions');
                }
                if (event.target && typeof event.target.setOption === 'function') {
                  event.target.setOption('captions', 'track', {});
                }
              } catch (e) {}
              if (pendingPlayRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
                try {
                  ytPlayerRef.current.playVideo();
                } catch (e) {}
              }
            },
            onStateChange: (event: any) => {
              try {
                if (event.target && typeof event.target.unloadModule === 'function') {
                  event.target.unloadModule('captions');
                }
              } catch (e) {}
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                if (loopModeRef.current) {
                  event.target.seekTo(0, true);
                  event.target.playVideo();
                } else {
                  handleSkip();
                }
              }
            }
          }
        });
      } catch (err) {
        console.warn("YouTube player setup deferred:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    }

    const interval = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerReadyRef.current && isPlaying) {
        const current = ytPlayerRef.current.getCurrentTime();
        const duration = ytPlayerRef.current.getDuration();
        if (duration > 0) {
          setSongCurrentTime(current);
          setSongDuration(duration);
          setSongProgress((current / duration) * 100);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, loopMode]);

  const handleSearch = async (placement: 'header' | 'module' = 'module') => {
    if (!searchQuery.trim()) return;
    setSearchPlacement(placement);
    setIsSearching(true);
    setSearchError('');
    try {
      const videoId = searchQuery.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
      if (videoId) {
        setSearchResults([{ id: videoId, name: `YouTube video · ${videoId}`, thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` }]);
        return;
      }

      const queryLower = searchQuery.toLowerCase().trim();
      const localMatches = SONGS.filter((song) => {
        return song.name.toLowerCase().includes(queryLower) || song.id.toLowerCase().includes(queryLower);
      }).map((song) => ({
        id: song.id,
        name: song.name,
        channel: 'Slendo Queue',
        thumbnail: `https://img.youtube.com/vi/${song.id}/mqdefault.jpg`
      }));

      let remoteMatches: any[] = [];
      try {
        const res = await fetch('/api/search/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery.trim() })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            remoteMatches = data.map((item: any) => {
              const id = item.id?.videoId || item.id;
              return {
                id,
                name: item.snippet?.title || 'YouTube video',
                channel: item.snippet?.channelTitle,
                thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://img.youtube.com/vi/${id}/mqdefault.jpg`
              };
            }).filter((item: any) => item.id);
          }
        }
      } catch {}

      const seenIds = new Set<string>();
      const combined = [...localMatches, ...remoteMatches].filter((s) => {
        if (!s.id || seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      setSearchResults(combined);
      if (!combined.length) setSearchError('No videos found. Try another search.');
    } catch (e) {
      console.error("Search error:", e);
      setSearchResults([]);
      setSearchError('Could not reach YouTube search right now. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const renderVideoResults = (placement: 'header' | 'module') => searchPlacement === placement && (searchResults.length > 0 || searchError) ? (
    <div className={`z-[80] overflow-hidden rounded-2xl border border-red-400/20 bg-[#0b090d]/95 shadow-[0_18px_60px_rgba(0,0,0,.7)] backdrop-blur-2xl ${placement === 'header' ? 'absolute left-0 right-0 top-[calc(100%+10px)]' : 'w-full max-w-md'}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-[.2em] text-white/45">YouTube results <span className="text-red-400">{searchResults.length || ''}</span></span>
        <button onClick={() => { setSearchResults([]); setSearchError(''); }} className="text-[10px] text-white/40 transition hover:text-white">Close</button>
      </div>
      {searchError ? <p className="px-4 py-4 text-xs text-white/55">{searchError}</p> : <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
        {searchResults.map((result) => <button key={`${placement}-${result.id}`} onClick={() => { playSongFromSearch(result); setSearchResults([]); }} className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-red-500/10">
          <img src={result.thumbnail} alt="" className="h-12 w-[86px] shrink-0 rounded-lg object-cover" />
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white/85 group-hover:text-white">{result.name}</span><span className="mt-1 block truncate text-[10px] text-white/35">{result.channel || 'YouTube'}</span></span>
          <span className="rounded-full bg-red-500/15 px-3 py-1.5 text-[10px] font-bold text-red-300">PLAY</span>
        </button>)}
      </div>}
    </div>
  ) : null;

  const loadAndPlayTrack = (id: string) => {
    if (ytPlayerRef.current && ytPlayerReadyRef.current) {
      ytPlayerRef.current.loadVideoById(id);
      try {
        if (typeof ytPlayerRef.current.unloadModule === 'function') {
          ytPlayerRef.current.unloadModule('captions');
        }
        if (typeof ytPlayerRef.current.setOption === 'function') {
          ytPlayerRef.current.setOption('captions', 'track', {});
        }
      } catch (e) {}
      setIsPlaying(true);
    }
  };

  const playSongFromSearch = (song: any) => {
    const newQueue = [song, ...songQueue];
    setSongQueue(newQueue);
    setCurrentSongIndex(0);
    loadAndPlayTrack(song.id);
  };

  const playSongAtIndex = (index: number) => {
    if (index < 0 || index >= songQueue.length) return;
    setCurrentSongIndex(index);
    loadAndPlayTrack(songQueue[index].id);
  };

  const resetQueueToDefault = () => {
    setSongQueue(SONGS);
    setCurrentSongIndex(0);
    loadAndPlayTrack(SONGS[0].id);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSongProgress(val);
    if (ytPlayerRef.current && ytPlayerReadyRef.current) {
      const duration = ytPlayerRef.current.getDuration();
      ytPlayerRef.current.seekTo((val / 100) * duration, true);
    }
  };

  const toggleShuffle = () => setShuffleMode(!shuffleMode);
  const toggleRepeat = () => {
    loopModeRef.current = !loopModeRef.current;
    setLoopMode(loopModeRef.current);
    setRepeatMode(loopModeRef.current);
  };

  const handlePrevious = () => {
    if (currentSongIndex > 0) {
      const nextIndex = currentSongIndex - 1;
      setCurrentSongIndex(nextIndex);
      loadAndPlayTrack(songQueue[nextIndex].id);
    }
  };

  const handleSkip = () => {
    setShuffleMode(true);
    let nextIndex = currentSongIndex + 1;
    if (songQueue.length > 1) {
      const choices = songQueue.map((_, index) => index).filter(index => index !== currentSongIndex);
      nextIndex = choices[Math.floor(Math.random() * choices.length)];
    } else if (nextIndex >= songQueue.length) {
      if (repeatMode) {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    
    setCurrentSongIndex(nextIndex);
    loadAndPlayTrack(songQueue[nextIndex].id);
  };

  const togglePlay = () => {
    if (!ytPlayerRef.current || !ytPlayerReadyRef.current) return;
    if (isPlaying) {
      ytPlayerRef.current.pauseVideo();
    } else {
      ytPlayerRef.current.playVideo();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    if (ytPlayerRef.current && ytPlayerReadyRef.current) {
      ytPlayerRef.current.setVolume(val);
    }
  };

  const toggleMute = () => {
    if (!ytPlayerRef.current || !ytPlayerReadyRef.current) return;
    if (isMuted) {
      ytPlayerRef.current.unMute();
    } else {
      ytPlayerRef.current.mute();
    }
    setIsMuted(!isMuted);
  };

  // Handle Enter / Start
  const handleEnter = () => {
    setHasEntered(true);
    setShowWelcomeNotif(true);
    pendingPlayRef.current = true;
    try {
      const audio = new Audio('https://www.myinstants.com/media/sounds/discord-notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
    
    setTimeout(() => {
      setShowWelcomeNotif(false);
    }, 5000);

    if (ytPlayerRef.current && ytPlayerReadyRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
      try {
        ytPlayerRef.current.playVideo();
      } catch (err) {
        console.warn("Autoplay deferred:", err);
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchProfile = async () => {
      if (activeTab === 'about-me' && token) {
        setAboutMeLoading(true);
        try {
          const [profileRes, userRes] = await Promise.all([
            fetch('https://discord.com/api/v9/users/1288332302543360026/profile?with_mutual_guilds=false', {
              headers: { 'Authorization': token }
            }),
            fetch('https://discord.com/api/v9/users/1288332302543360026', {
              headers: { 'Authorization': token }
            })
          ]);
          
          const profileData = await profileRes.json();
          const userData = await userRes.json();
          
          setAboutMeProfile({ ...profileData, user: userData });
        } catch (e) {
          console.error("Error fetching About Me profile:", e);
        } finally {
          setAboutMeLoading(false);
        }
      }
    };

    if (activeTab === 'about-me' && token) {
      fetchProfile();
      interval = setInterval(fetchProfile, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, token]);

  const getRelativeTime = (snowflake: string | null) => {
    if (!snowflake) return 'No activity';
    try {
      const timestamp = Number((BigInt(snowflake) >> 22n) + 1420070400000n);
      const now = Date.now();
      const diff = now - timestamp;
      
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      if (seconds > 10) return `${seconds}s ago`;
      return 'Just now';
    } catch {
      return 'Unknown';
    }
  };

  const refreshDms = async () => {
    if (!token) return;
    setIsRefreshingDms(true);
    try {
      const res = await fetch('https://discord.com/api/v9/users/@me/channels', {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const filtered = data
            .filter((c: any) => c.type === 1 || c.type === 3)
            .sort((a: any, b: any) => {
              const aId = BigInt(a.last_message_id || '0');
              const bId = BigInt(b.last_message_id || '0');
              if (bId > aId) return 1;
              if (bId < aId) return -1;
              return 0;
            });
          setDms(filtered);
        }
      }
    } catch (e) {
      console.error("Error refreshing DMs:", e);
    } finally {
      setIsRefreshingDms(false);
    }
  };

  const refreshGuilds = async () => {
    if (!token) return;
    setIsRefreshingGuilds(true);
    try {
      const res = await fetch('https://discord.com/api/v9/users/@me/guilds', {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setGuilds(data);
        }
      }
    } catch (e) {
      console.error("Error refreshing guilds:", e);
    } finally {
      setIsRefreshingGuilds(false);
    }
  };

  const refreshFriends = async () => {
    if (!token) return;
    setIsRefreshingFriends(true);
    try {
      const res = await fetch('https://discord.com/api/v9/users/@me/relationships', {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const friendList = data
            .filter((rel: any) => rel.type === 1 && rel.user)
            .sort((a: any, b: any) => {
              const nameA = (a.nickname || a.user?.global_name || a.user?.username || '').toLowerCase();
              const nameB = (b.nickname || b.user?.global_name || b.user?.username || '').toLowerCase();
              return nameA.localeCompare(nameB);
            });
          setFriends(friendList);
        }
      }
    } catch (e) {
      console.error("Error refreshing friends:", e);
    } finally {
      setIsRefreshingFriends(false);
    }
  };

  // Fetch User on Token Change
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setCurrentUser(null);
      setUserId('');
      setGuilds([]);
      setDms([]);
      setFriends([]);
      setSelectedFriendIds(new Set());
      setTokenStatus('idle');
      return () => {
        cancelled = true;
      };
    }
    setTokenStatus('checking');
    const fetchInitialData = async () => {
      let verified = false;
      const isAppSessionFailure = async (response: Response) => {
        if (response.status !== 401) return false;
        const errorData = await response.clone().json().catch(() => null);
        if (errorData?.code !== 'APP_SESSION_REQUIRED') return false;
        if (!cancelled) setTokenStatus('session-expired');
        return true;
      };
      // Only Discord's own 401 JSON means "this token is bad". A host or CDN block
      // page carries a 401-looking status without that body, and must not be shown
      // to the reader as a rejected token.
      const isTokenRejection = async (response: Response) => {
        if (response.status !== 401) return false;
        if ((response.headers.get('content-type') || '').includes('text/html')) return false;
        const body = await response.clone().json().catch(() => null);
        return Boolean(body && typeof body.message === 'string');
      };
      try {
        const userRes = await fetch('https://discord.com/api/v9/users/@me', {
          headers: { 'Authorization': token }
        });
        if (cancelled) return;
        if (userRes.ok) {
          const userData = await userRes.json();
          if (cancelled) return;
          setCurrentUser(userData);
          setUserId(userData.id);
          setTokenStatus('connected');
          verified = true;
        } else {
          setCurrentUser(null);
          setUserId('');
          if (await isAppSessionFailure(userRes)) return;
          if (cancelled) return;
          setTokenStatus((await isTokenRejection(userRes)) ? 'rejected' : 'unavailable');
          return;
        }

        const guildsRes = await fetch('https://discord.com/api/v9/users/@me/guilds', {
          headers: { 'Authorization': token }
        });
        if (cancelled) return;
        if (await isAppSessionFailure(guildsRes)) return;
        if (guildsRes.ok) {
          setGuilds(await guildsRes.json());
        }

        const dmsRes = await fetch('https://discord.com/api/v9/users/@me/channels', {
          headers: { 'Authorization': token }
        });
        if (cancelled) return;
        if (await isAppSessionFailure(dmsRes)) return;
        if (dmsRes.ok) {
          const dmsData = await dmsRes.json();
          setDms(dmsData.filter((c: any) => c.type === 1 || c.type === 3));
        }

        const relRes = await fetch('https://discord.com/api/v9/users/@me/relationships', {
          headers: { 'Authorization': token }
        });
        if (cancelled) return;
        if (await isAppSessionFailure(relRes)) return;
        if (relRes.ok) {
          const relData = await relRes.json();
          if (Array.isArray(relData)) {
            const friendList = relData
              .filter((rel: any) => rel.type === 1 && rel.user)
              .sort((a: any, b: any) => {
                const nameA = (a.nickname || a.user?.global_name || a.user?.username || '').toLowerCase();
                const nameB = (b.nickname || b.user?.global_name || b.user?.username || '').toLowerCase();
                return nameA.localeCompare(nameB);
              });
            setFriends(friendList);
          }
        }
      } catch (e) {
        if (!cancelled) {
          if (!verified) setTokenStatus('unavailable');
          console.error(e);
        }
      }
    };
    fetchInitialData();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetchGuildChannels = async (guildId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedGuildChannels(data.filter((c: any) => c.type === 0).sort((a: any, b: any) => (a.position || 0) - (b.position || 0)));
      }
    } catch (e) { console.error(e); }
  };

  // Helper: Send Message
  const sendDiscordMessage = async (content: string, mode: 'normal' | 'autobeefer' | 'legit' = 'normal') => {
    if (!token || !channelId) return;

    let finalContent = content;
    
    const currentCase = mode === 'autobeefer' ? autobeeferCase : mode === 'legit' ? legitCase : textCase;
    if (currentCase === 'upper') finalContent = finalContent.toUpperCase();
    if (currentCase === 'lower') finalContent = finalContent.toLowerCase();

    if (mode === 'autobeefer') {
      if (autoBold && Math.random() < boldChance / 100) finalContent = `# ${finalContent}`;
      if (ladderMode && Math.random() < ladderChance / 100) {
        finalContent = finalContent.split(/\s+/).filter(w => w.length > 0).join('\n');
      }
    }

    if (mode === 'normal' && randomEffects) {
      const r = Math.random();
      if (r < 0.15) finalContent = `# ${finalContent}`;
      else if (r < 0.3) finalContent = `- ${finalContent}`;
      else if (r < 0.45) finalContent = `${finalContent} 🤡`;
    }

    const pingText = userPing ? ` <@${userPing}>` : '';
    
    // Construct final message with prefix/suffix
    let msg = '';
    if (startMsg) msg += `${startMsg} `;
    msg += finalContent;
    if (endMsg) msg += ` ${endMsg}`;
    if (pingText) msg += pingText;

    // Add mention target if enabled
    if (mentionTarget && userId) {
      msg = `<@${userId}> ${msg}`;
    }

    finalContent = msg.trim();

    if (typingIndicator) {
      await fetch(`https://discord.com/api/v9/channels/${channelId}/typing`, {
        method: 'POST',
        headers: { 'Authorization': token }
      });
    }

    try {
      const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: finalContent })
      });
      
      const data = await res.json();
      if (data.id && autoReact) {
        await fetch(`https://discord.com/api/v9/channels/${channelId}/messages/${data.id}/reactions/${encodeURIComponent(reactionEmoji)}/@me`, {
          method: 'PUT',
          headers: { 'Authorization': token }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendTypingIndicator = async () => {
    if (!token || !channelId) return;
    try {
      await fetch(`https://discord.com/api/v9/channels/${channelId}/typing`, {
        method: 'POST',
        headers: { 'Authorization': token }
      });
    } catch (e) {
      console.error("Typing indicator error:", e);
    }
  };

  // Mass DM Helpers & Broadcaster
  const addMassDmLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setMassDmLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 150));
  };

  const handleMassDmImageChange = (file: File | null) => {
    if (massDmImagePreview) {
      URL.revokeObjectURL(massDmImagePreview);
    }
    if (!file) {
      setMassDmImageFile(null);
      setMassDmImagePreview(null);
      return;
    }
    setMassDmImageFile(file);
    setMassDmImagePreview(URL.createObjectURL(file));
  };

  const toggleFriendSelection = (friendId: string) => {
    if (massDmActive) return;
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const selectAllFriends = () => {
    if (massDmActive) return;
    setSelectedFriendIds(new Set(friends.map(f => f.user.id)));
  };

  const unselectAllFriends = () => {
    if (massDmActive) return;
    setSelectedFriendIds(new Set());
  };

  const selectFilteredFriends = (filteredIds: string[]) => {
    if (massDmActive) return;
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      filteredIds.forEach(id => next.add(id));
      return next;
    });
  };

  const unselectFilteredFriends = (filteredIds: string[]) => {
    if (massDmActive) return;
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      filteredIds.forEach(id => next.delete(id));
      return next;
    });
  };

  const handleStopMassDm = () => {
    massDmStoppedRef.current = true;
    setMassDmStatus('Stopping after current step...');
    addMassDmLog('Mass DM stopped by user.', 'warn');
  };

  const handleStartMassDm = async () => {
    if (!token) {
      setMassDmStatus('Enter your Discord token first.');
      return;
    }
    const targetFriends = friends.filter(f => selectedFriendIds.has(f.user.id));
    if (targetFriends.length === 0) {
      setMassDmStatus('Select at least 1 friend from your friends list.');
      return;
    }
    if (!massDmMessage.trim() && !massDmImageFile) {
      setMassDmStatus('Enter a message or attach an image to send.');
      return;
    }

    massDmStoppedRef.current = false;
    setMassDmActive(true);
    setMassDmLogs([]);
    setMassDmProgress({ current: 0, total: targetFriends.length, sent: 0, failed: 0 });
    const effectiveDelayMs = Math.max(3000, Math.round(massDmDelay * 1000));

    addMassDmLog(
      `Starting Mass DM to ${targetFriends.length} friend${targetFriends.length === 1 ? '' : 's'} (${(effectiveDelayMs / 1000).toFixed(1)}s delay${massDmTypingIndicator ? ' + typing indicator' : ''}).`,
      'info'
    );

    const cancellableWait = async (ms: number, onTick?: (remainingMs: number) => void) => {
      const step = 100;
      let elapsed = 0;
      while (elapsed < ms) {
        if (massDmStoppedRef.current) return false;
        if (onTick) onTick(Math.max(0, ms - elapsed));
        const chunk = Math.min(step, ms - elapsed);
        await new Promise(resolve => setTimeout(resolve, chunk));
        elapsed += chunk;
      }
      return !massDmStoppedRef.current;
    };

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetFriends.length; i++) {
      if (massDmStoppedRef.current) break;
      const friendRel = targetFriends[i];
      const friend = friendRel.user;
      const displayName = friendRel.nickname || friend.global_name || friend.display_name || friend.username;

      setMassDmProgress({ current: i + 1, total: targetFriends.length, sent: sentCount, failed: failedCount });
      setMassDmStatus(`Opening DM with ${displayName} (@${friend.username})...`);

      try {
        // 1. Resolve or open DM channel
        let dmChannelId = dms.find(
          (c: any) => c.type === 1 && Array.isArray(c.recipients) && c.recipients.some((r: any) => r.id === friend.id)
        )?.id;

        if (!dmChannelId) {
          let openRes = await fetch('https://discord.com/api/v9/users/@me/channels', {
            method: 'POST',
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: friend.id })
          });

          if (openRes.status === 429) {
            const rl = await openRes.json().catch(() => ({}));
            const waitMs = Math.ceil(((rl.retry_after || 3) + 0.5) * 1000);
            addMassDmLog(`Rate limited opening DM for @${friend.username}. Waiting ${(waitMs / 1000).toFixed(1)}s...`, 'warn');
            const ok = await cancellableWait(waitMs);
            if (!ok) break;
            openRes = await fetch('https://discord.com/api/v9/users/@me/channels', {
              method: 'POST',
              headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: friend.id })
            });
          }

          if (!openRes.ok) {
            const errData = await openRes.json().catch(() => ({}));
            throw new Error(errData.message || `Cannot open DM (HTTP ${openRes.status})`);
          }
          const dmData = await openRes.json();
          dmChannelId = dmData.id;
        }

        if (massDmStoppedRef.current) break;

        // 2. Typing indicator + 3s delay before sending DM
        if (massDmTypingIndicator) {
          await fetch(`https://discord.com/api/v9/channels/${dmChannelId}/typing`, {
            method: 'POST',
            headers: { 'Authorization': token }
          }).catch(() => {});
        }

        const waitedOk = await cancellableWait(effectiveDelayMs, (remainingMs) => {
          setMassDmStatus(
            `${massDmTypingIndicator ? 'Typing' : 'Waiting'} in DM to ${displayName} (@${friend.username})... ${(remainingMs / 1000).toFixed(1)}s`
          );
        });
        if (!waitedOk) break;

        // 3. Send message and/or image attachment
        setMassDmStatus(`Sending DM to ${displayName} (@${friend.username})...`);

        const sendAttempt = async () => {
          if (massDmImageFile) {
            const formData = new FormData();
            formData.append(
              'payload_json',
              JSON.stringify({ content: massDmMessage.trim() || '' })
            );
            formData.append('files[0]', massDmImageFile, massDmImageFile.name);
            return fetch(`https://discord.com/api/v9/channels/${dmChannelId}/messages`, {
              method: 'POST',
              headers: { 'Authorization': token },
              body: formData
            });
          }
          return fetch(`https://discord.com/api/v9/channels/${dmChannelId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: massDmMessage.trim() })
          });
        };

        let sendRes = await sendAttempt();
        if (sendRes.status === 429) {
          const rl = await sendRes.json().catch(() => ({}));
          const waitMs = Math.ceil(((rl.retry_after || 5) + 0.5) * 1000);
          addMassDmLog(`Rate limited sending to @${friend.username}. Waiting ${(waitMs / 1000).toFixed(1)}s...`, 'warn');
          const ok = await cancellableWait(waitMs);
          if (!ok) break;
          if (massDmTypingIndicator) {
            await fetch(`https://discord.com/api/v9/channels/${dmChannelId}/typing`, {
              method: 'POST',
              headers: { 'Authorization': token }
            }).catch(() => {});
          }
          sendRes = await sendAttempt();
        }

        if (!sendRes.ok) {
          const errData = await sendRes.json().catch(() => ({}));
          throw new Error(errData.message || `Failed to send (HTTP ${sendRes.status})`);
        }

        sentCount++;
        setMassDmProgress({ current: i + 1, total: targetFriends.length, sent: sentCount, failed: failedCount });
        addMassDmLog(`Sent DM to ${displayName} (@${friend.username})`, 'success');
      } catch (err: any) {
        failedCount++;
        setMassDmProgress({ current: i + 1, total: targetFriends.length, sent: sentCount, failed: failedCount });
        addMassDmLog(`Failed for @${friend.username}: ${err.message || 'Unknown error'}`, 'error');
      }
    }

    setMassDmActive(false);
    if (massDmStoppedRef.current) {
      setMassDmStatus(`Stopped. Sent ${sentCount}/${targetFriends.length} DMs (${failedCount} failed).`);
    } else {
      setMassDmStatus(`Completed! Sent ${sentCount}/${targetFriends.length} DMs (${failedCount} failed).`);
      addMassDmLog(`Finished Mass DM: ${sentCount} sent, ${failedCount} failed.`, 'info');
    }
  };

  // Typing Indicator Loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (typingIndicator && token && channelId) {
      sendTypingIndicator();
      interval = setInterval(sendTypingIndicator, 8000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [typingIndicator, token, channelId]);

  // Auto Reply Logic
  useEffect(() => {
    if (autoReplyActive && token && userId) {
      autoReplyHandledIds.current.clear();
      autoReplyBaselineIdRef.current = '';
      autoReplyRecentPoolRef.current = [];

      const initBaseline = async () => {
        try {
          const targetUrl = channelId 
            ? `https://discord.com/api/v9/channels/${channelId}/messages?limit=1`
            : `https://discord.com/api/v9/users/@me/mentions?limit=1`;
            
          const res = await fetch(targetUrl, {
            headers: { 'Authorization': token }
          });
          if (res.ok) {
            const msgs = await res.json();
            if (msgs && msgs.length > 0) {
              const bId = msgs[0].id;
              autoReplyBaselineIdRef.current = bId;
              setLastRepliedMsgId(bId);
              autoReplyHandledIds.current.add(bId);
            }
          }
        } catch (e) { console.error("Auto reply baseline error:", e); }
      };

      initBaseline();

      autoReplyIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`https://discord.com/api/v9/users/@me/mentions?limit=25`, {
            headers: { 'Authorization': token }
          });
          
          const dmsRes = await fetch(`https://discord.com/api/v9/users/@me/channels`, {
            headers: { 'Authorization': token }
          });
          
          let allMessages: any[] = [];
          
          if (res.ok) {
            const mentionData = await res.json();
            if (Array.isArray(mentionData)) allMessages.push(...mentionData);
          }
          
          if (dmsRes.ok) {
            const dmChannels = await dmsRes.json();
            const activeDms = dmChannels.filter((c: any) => (c.type === 1 || c.type === 3) && c.last_message_id);
            for (const dm of activeDms.slice(0, 5)) {
              try {
                const dmMsgRes = await fetch(`https://discord.com/api/v9/channels/${dm.id}/messages?limit=3`, {
                  headers: { 'Authorization': token }
                });
                if (dmMsgRes.ok) {
                  const dmMsgs = await dmMsgRes.json();
                  if (Array.isArray(dmMsgs)) allMessages.push(...dmMsgs);
                }
              } catch {}
            }
          }
          
          if (channelId) {
            try {
              const chanRes = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages?limit=5`, {
                headers: { 'Authorization': token }
              });
              if (chanRes.ok) {
                const chanMsgs = await chanRes.json();
                if (Array.isArray(chanMsgs)) allMessages.push(...chanMsgs);
              }
            } catch {}
          }

          const targetMessages = allMessages.filter((m: any) => 
            m && m.id && m.author?.id === userId && 
            m.id > autoReplyBaselineIdRef.current && 
            !autoReplyHandledIds.current.has(m.id)
          );
          
          targetMessages.sort((a: any, b: any) => b.id.localeCompare(a.id));
          
          const messages = targetMessages.slice(0, 1);
          if (messages && messages.length > 0) {
            const lastMsg = messages[0];
            if (lastMsg.id > autoReplyBaselineIdRef.current && !autoReplyHandledIds.current.has(lastMsg.id)) {
              autoReplyHandledIds.current.add(lastMsg.id);
              
              sendTypingIndicator();
              
              const jitter = Math.floor(Math.random() * 1500);
              const actualDelay = (autoReplyDelay * 1000) + jitter;

              setTimeout(async () => {
                let finalMsg = '';
                
                const applyCase = (text: string, mode: 'none' | 'upper' | 'lower' | 'ladder') => {
                  if (mode === 'upper') return text.toUpperCase();
                  if (mode === 'lower') return text.toLowerCase();
                  if (mode === 'ladder') return text.split(' ').filter(w => w.length > 0).join('\n');
                  return text;
                };

                const getIntro = (name: string) => {
                  const intros = [`hey ${name}`, `yo ${name}`, `listen ${name}`, `sup ${name}`, `weakling named ${name}`];
                  return intros[Math.floor(Math.random() * intros.length)];
                };

                const getRealisticRandomIndex = (list: any[]) => {
                  if (list.length === 0) return -1;
                  if (list.length <= 4) return Math.floor(Math.random() * list.length);
                  
                  let idx = -1;
                  let attempts = 0;
                  while (attempts < 15) {
                    idx = Math.floor(Math.random() * list.length);
                    if (!autoReplyRecentPoolRef.current.includes(idx)) break;
                    attempts++;
                  }
                  autoReplyRecentPoolRef.current.push(idx);
                  if (autoReplyRecentPoolRef.current.length > 4) autoReplyRecentPoolRef.current.shift();
                  return idx;
                };

                let rawMsg = '';
                if (autoReplyCustomMessages) {
                  const customMsgs = autoReplyCustomMessages.split(',').map(m => m.trim()).filter(m => m.length > 0);
                  const idx = getRealisticRandomIndex(customMsgs);
                  if (idx !== -1) rawMsg = customMsgs[idx];
                } else if (autoReplyMessages.length > 0) {
                  const idx = getRealisticRandomIndex(autoReplyMessages);
                  if (idx !== -1) rawMsg = autoReplyMessages[idx];
                } else {
                  const source = autobeeferMessages.length > 0 ? autobeeferMessages : STARTERS;
                  rawMsg = source[Math.floor(Math.random() * source.length)];
                }

                if (rawMsg) {
                  rawMsg = applyCase(rawMsg, autoReplyCase);
                  if (autoReplyIntroEnabled && autoReplyCustomName) {
                    finalMsg = `${getIntro(autoReplyCustomName)} ${rawMsg}`;
                  } else if (autoReplyCustomName) {
                    finalMsg = `${autoReplyCustomName} ${rawMsg}`;
                  } else {
                    finalMsg = rawMsg;
                  }
                }

                const shouldMention = Math.random() < 0.98;
                const shouldReply = Math.random() < 0.70;

                let messageContent = finalMsg;
                if (shouldMention) {
                  messageContent = `<@${lastMsg.author.id}> ${finalMsg}`;
                }

                const body: any = { content: messageContent };
                if (shouldReply) {
                  body.message_reference = { message_id: lastMsg.id };
                  body.allowed_mentions = { parse: ['users'], replied_user: false };
                }

                try {
                  await fetch(`https://discord.com/api/v9/channels/${lastMsg.channel_id}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': token,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                  });
                } catch (e) { console.error(e); }
                setLastRepliedMsgId(lastMsg.id);
              }, actualDelay);
            }
          }
        } catch (e) {
          console.error("Auto reply error:", e);
        }
      }, 300);
    } else {
      if (autoReplyIntervalRef.current) clearInterval(autoReplyIntervalRef.current);
    }
    return () => {
      if (autoReplyIntervalRef.current) clearInterval(autoReplyIntervalRef.current);
    };
  }, [autoReplyActive, token, channelId, userId, autoReplyDelay, autoReplyCustomName, autoReplyCustomMessages, autobeeferMessages, autoReplyMessages, mentionTarget, autoReplyCase, autoReplyIntroEnabled]);

  // AFK Check Logic
  const afkCheckRunningRef = useRef(false);

  useEffect(() => {
    if (afkCheckActive) {
      if (afkCheckRunningRef.current) return;
      afkCheckRunningRef.current = true;

      afkCheckCounterRef.current = afkCheckValue;
      setAfkCheckCurrent(afkCheckValue);

      const tokenSnap = token;
      const channelSnap = channelId;

      const sendMsg = async (num: number) => {
        if (!tokenSnap || !channelSnap) return;
        try {
          await fetch(`https://discord.com/api/v9/channels/${channelSnap}/messages`, {
            method: 'POST',
            headers: { 'Authorization': tokenSnap, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `${num}` })
          });
        } catch (e) { console.error(e); }
      };

      sendMsg(afkCheckCounterRef.current);

      afkCheckIntervalRef.current = setInterval(async () => {
        afkCheckCounterRef.current -= 1;
        if (afkCheckCounterRef.current < 0) {
          if (afkCheckIntervalRef.current) clearInterval(afkCheckIntervalRef.current);
          afkCheckRunningRef.current = false;
          setAfkCheckActive(false);
          return;
        }
        setAfkCheckCurrent(afkCheckCounterRef.current);
        await sendMsg(afkCheckCounterRef.current);
      }, afkCheckDelay * 1000);

    } else {
      if (afkCheckIntervalRef.current) clearInterval(afkCheckIntervalRef.current);
      afkCheckRunningRef.current = false;
    }
    return () => {
      if (afkCheckIntervalRef.current) clearInterval(afkCheckIntervalRef.current);
      afkCheckRunningRef.current = false;
    };
  }, [afkCheckActive]);

  useEffect(() => {
    if (forceNickActive && token && forceNickGuildId && forceNickName) {
      
      const applyNickname = async () => {
        try {
          const res = await fetch(`https://discord.com/api/v9/guilds/${forceNickGuildId}/members/@me`, {
            method: 'PATCH',
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nick: forceNickName })
          });
          if (res.ok) {
            setForceNickStatus(`✅ Nickname locked to: ${forceNickName}`);
            forceNickLastNameRef.current = forceNickName;
          } else if (res.status === 429) {
            const data = await res.json();
            setForceNickStatus(`⚠️ Rate limited, waiting ${data.retry_after}s...`);
          }
        } catch (e) {
          setForceNickStatus('❌ Error applying nickname');
        }
      };

      const checkAndForce = async () => {
        try {
          const res = await fetch(`https://discord.com/api/v9/guilds/${forceNickGuildId}/members/@me`, {
            headers: { 'Authorization': token }
          });
          if (res.ok) {
            const data = await res.json();
            const currentNick = data.nick || data.user?.username || '';
            if (currentNick !== forceNickName) {
              setForceNickStatus(`⚡ Name changed to "${currentNick}" — forcing back...`);
              await applyNickname();
            }
          }
        } catch (e) {
          console.error('Force nick check error:', e);
        }
      };

      // Apply immediately on start
      applyNickname();

      // Then check every 800ms and force back if changed
      forceNickIntervalRef.current = setInterval(checkAndForce, 800);

    } else {
      if (forceNickIntervalRef.current) clearInterval(forceNickIntervalRef.current);
    }
    return () => {
      if (forceNickIntervalRef.current) clearInterval(forceNickIntervalRef.current);
    };
  }, [forceNickActive, token, forceNickGuildId, forceNickName]);

  useEffect(() => {
    if (forceOtherActive && token && forceOtherGuildId && forceOtherUserId && forceOtherNickName) {

      const applyOtherNickname = async () => {
        try {
          const res = await fetch(`https://discord.com/api/v9/guilds/${forceOtherGuildId}/members/${forceOtherUserId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nick: forceOtherNickName })
          });
          if (res.ok) {
            setForceOtherStatus(`✅ Locked ${forceOtherUserId} to: ${forceOtherNickName}`);
          } else if (res.status === 429) {
            const data = await res.json();
            setForceOtherStatus(`⚠️ Rate limited, waiting ${data.retry_after}s...`);
            await new Promise(r => setTimeout(r, data.retry_after * 1000));
          } else if (res.status === 403) {
            setForceOtherStatus('❌ Missing permissions to nickname this user');
          }
        } catch (e) {
          setForceOtherStatus('❌ Error applying nickname to user');
        }
      };

      const checkAndForceOther = async () => {
        try {
          const res = await fetch(`https://discord.com/api/v9/guilds/${forceOtherGuildId}/members/${forceOtherUserId}`, {
            headers: { 'Authorization': token }
          });
          if (res.ok) {
            const data = await res.json();
            const currentNick = data.nick || '';
            // Force back if nickname was changed OR removed (empty)
            if (currentNick !== forceOtherNickName) {
              if (currentNick === '') {
                setForceOtherStatus(`⚡ Nickname was removed — forcing back to "${forceOtherNickName}"...`);
              } else {
                setForceOtherStatus(`⚡ Nickname changed to "${currentNick}" — forcing back...`);
              }
              await applyOtherNickname();
            }
          }
        } catch (e) {
          console.error('Force other nick check error:', e);
        }
      };

      // Apply immediately
      applyOtherNickname();

      // Check every 800ms
      forceOtherIntervalRef.current = setInterval(checkAndForceOther, 800);

    } else {
      if (forceOtherIntervalRef.current) clearInterval(forceOtherIntervalRef.current);
    }
    return () => {
      if (forceOtherIntervalRef.current) clearInterval(forceOtherIntervalRef.current);
    };
  }, [forceOtherActive, token, forceOtherGuildId, forceOtherUserId, forceOtherNickName]);

  const extractSnowflake = (input: string): string | null => {
    if (!input) return null;
    const clean = input.trim();
    if (/^\d{17,21}$/.test(clean)) return clean;
    const mentionMatch = clean.match(/<@!?(\d{17,21})>/);
    if (mentionMatch) return mentionMatch[1];
    const urlMatch = clean.match(/(?:discord\.com|discordapp\.com)\/users\/(\d{17,21})/);
    if (urlMatch) return urlMatch[1];
    return null;
  };

  const getHighestQualityCdnUrl = (basePath: string, hash: string | null | undefined, size = 4096) => {
    if (!hash) return null;
    const ext = hash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/${basePath}/${hash}.${ext}?size=${size}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  const handleRobber = async (customTarget?: string, customGuild?: string) => {
    if (!token) {
      setRobberStatus('Token required — enter your Discord token in the Normal tab first');
      return;
    }
    const rawTarget = (customTarget !== undefined ? customTarget : robberTargetId).trim();
    const rawGuild = (customGuild !== undefined ? customGuild : robberGuildId).trim();

    let targetId = extractSnowflake(rawTarget);
    let guildId = extractSnowflake(rawGuild);

    setIsRobbing(true);
    setRobberStatus('Resolving user credentials & ID...');
    setRobberResult(null);
    setRobberFoundCandidates([]);

    try {
      // If user typed a username, tag, or display name instead of a pure numeric snowflake:
      if (!targetId && rawTarget) {
        const query = rawTarget.toLowerCase().replace(/^@/, '');
        setRobberStatus(`Searching for user ID matching "${rawTarget}"...`);

        const matchedUsers: any[] = [];
        const seenIds = new Set<string>();

        // 1. Search recent DMs list
        for (const dm of dms) {
          if (Array.isArray(dm.recipients)) {
            for (const r of dm.recipients) {
              if (!seenIds.has(r.id)) {
                if (
                  r.username?.toLowerCase() === query ||
                  r.global_name?.toLowerCase() === query ||
                  r.id === query ||
                  r.username?.toLowerCase().includes(query) ||
                  r.global_name?.toLowerCase().includes(query)
                ) {
                  seenIds.add(r.id);
                  matchedUsers.push(r);
                }
              }
            }
          }
        }

        // 2. Search relationships / friends
        try {
          const relRes = await fetch('https://discord.com/api/v9/users/@me/relationships', {
            headers: { Authorization: token }
          });
          if (relRes.ok) {
            const relData = await relRes.json();
            if (Array.isArray(relData)) {
              for (const rel of relData) {
                const u = rel.user;
                if (u && !seenIds.has(u.id)) {
                  if (
                    u.username?.toLowerCase() === query ||
                    u.global_name?.toLowerCase() === query ||
                    u.id === query ||
                    u.username?.toLowerCase().includes(query) ||
                    u.global_name?.toLowerCase().includes(query)
                  ) {
                    seenIds.add(u.id);
                    matchedUsers.push(u);
                  }
                }
              }
            }
          }
        } catch {}

        // 3. Search members in selected Guild or first few guilds
        const searchGuilds = guildId ? [{ id: guildId }] : guilds.slice(0, 6);
        for (const g of searchGuilds) {
          try {
            const mRes = await fetch(
              `https://discord.com/api/v9/guilds/${g.id}/members/search?query=${encodeURIComponent(query)}&limit=5`,
              { headers: { Authorization: token } }
            );
            if (mRes.ok) {
              const members = await mRes.json();
              if (Array.isArray(members)) {
                for (const m of members) {
                  if (m.user && !seenIds.has(m.user.id)) {
                    seenIds.add(m.user.id);
                    matchedUsers.push({ ...m.user, nick: m.nick, guildId: g.id });
                  }
                }
              }
            }
          } catch {}
        }

        if (matchedUsers.length === 1) {
          targetId = matchedUsers[0].id;
          setRobberTargetId(targetId);
          if (matchedUsers[0].guildId && !guildId) {
            guildId = matchedUsers[0].guildId;
            setRobberGuildId(guildId);
          }
        } else if (matchedUsers.length > 1) {
          // Exact username match takes priority
          const exact = matchedUsers.find(
            (u) => u.username?.toLowerCase() === query || u.global_name?.toLowerCase() === query
          );
          if (exact) {
            targetId = exact.id;
            setRobberTargetId(targetId);
            if (exact.guildId && !guildId) {
              guildId = exact.guildId;
              setRobberGuildId(guildId);
            }
          } else {
            setRobberFoundCandidates(matchedUsers);
            targetId = matchedUsers[0].id;
            setRobberTargetId(targetId);
          }
        } else {
          throw new Error(`Could not find any user matching "${rawTarget}". Try entering their 18-digit numeric User ID, or choose directly from your DMs.`);
        }
      }

      if (!targetId && !guildId) {
        throw new Error('Enter a User ID, Username, or Guild ID');
      }

      setRobberStatus('Fetching 4K profile picture & banner assets...');

      if (targetId) {
        let profileData: any = null;
        let memberData: any = null;

        // Call profile endpoint to get banners, badges, theme colors, and server profile
        try {
          const profileUrl = `https://discord.com/api/v9/users/${targetId}/profile${guildId ? `?guild_id=${guildId}` : ''}`;
          const pRes = await fetch(profileUrl, {
            headers: { Authorization: token }
          });
          if (pRes.ok) {
            profileData = await pRes.json();
          }
        } catch (e) {}

        // Fallback or augment with base user endpoint
        let userObj = profileData?.user;
        if (!userObj) {
          const uRes = await fetch(`https://discord.com/api/v9/users/${targetId}`, {
            headers: { Authorization: token }
          });
          if (!uRes.ok) throw new Error('User not found on Discord. Double check the User ID.');
          userObj = await uRes.json();
        }

        // Guild member specific asset lookup
        if (guildId) {
          if (profileData?.guild_member) {
            memberData = profileData.guild_member;
          } else {
            try {
              const mRes = await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${targetId}`, {
                headers: { Authorization: token }
              });
              if (mRes.ok) {
                memberData = await mRes.json();
              }
            } catch {}
          }
        }

        const avatarHash = userObj.avatar;
        const bannerHash = userObj.banner || profileData?.user_profile?.banner;
        const memberAvatarHash = memberData?.avatar;
        const memberBannerHash = memberData?.banner;
        const accentColor = userObj.accent_color ?? profileData?.user_profile?.accent_color;
        const bannerColor = userObj.banner_color ?? profileData?.user_profile?.banner_color;
        const bio = profileData?.user_profile?.bio || userObj.bio || '';
        const globalName = userObj.global_name || userObj.display_name || userObj.username;

        let createdAt = '';
        try {
          const ts = Number((BigInt(targetId) >> 22n) + 1420070400000n);
          createdAt = new Date(ts).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } catch {}

        const globalAvatar = avatarHash
          ? getHighestQualityCdnUrl(`avatars/${targetId}`, avatarHash, 4096)
          : `https://cdn.discordapp.com/embed/avatars/${(BigInt(targetId) >> 22n) % 6n}.png?size=4096`;

        const globalBanner = bannerHash
          ? getHighestQualityCdnUrl(`banners/${targetId}`, bannerHash, 4096)
          : null;

        const serverAvatar = memberAvatarHash && guildId
          ? getHighestQualityCdnUrl(`guilds/${guildId}/users/${targetId}/avatars`, memberAvatarHash, 4096)
          : null;

        const serverBanner = memberBannerHash && guildId
          ? getHighestQualityCdnUrl(`guilds/${guildId}/users/${targetId}/banners`, memberBannerHash, 4096)
          : null;

        const hexColor = accentColor !== undefined && accentColor !== null
          ? `#${accentColor.toString(16).padStart(6, '0')}`
          : (bannerColor || null);

        setRobberResult({
          type: 'user',
          id: targetId,
          username: userObj.username,
          discriminator: userObj.discriminator,
          globalName,
          nickname: memberData?.nick || null,
          bio,
          createdAt,
          accentColor: hexColor,
          badges: profileData?.badges || [],
          avatar: serverAvatar || globalAvatar,
          globalAvatar,
          serverAvatar,
          banner: serverBanner || globalBanner,
          globalBanner,
          serverBanner,
          isAnimatedAvatar: !!avatarHash?.startsWith('a_') || !!memberAvatarHash?.startsWith('a_'),
          isAnimatedBanner: !!bannerHash?.startsWith('a_') || !!memberBannerHash?.startsWith('a_')
        });
        setRobberStatus('Assets successfully stolen in 4K resolution!');
      } else if (guildId) {
        const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}`, {
          headers: { Authorization: token }
        });
        if (!res.ok) throw new Error('Guild not found or invalid Guild ID');
        const data = await res.json();
        
        const icon = data.icon 
          ? getHighestQualityCdnUrl(`icons/${guildId}`, data.icon, 4096) 
          : null;
        const banner = data.banner 
          ? getHighestQualityCdnUrl(`banners/${guildId}`, data.banner, 4096) 
          : null;
        const splash = data.splash
          ? `https://cdn.discordapp.com/splashes/${guildId}/${data.splash}.png?size=4096`
          : null;
        const discovery = data.discovery_splash
          ? `https://cdn.discordapp.com/discovery-splashes/${guildId}/${data.discovery_splash}.png?size=4096`
          : null;

        setRobberResult({
          type: 'guild',
          id: guildId,
          name: data.name,
          description: data.description,
          icon,
          banner,
          splash,
          discovery
        });
        setRobberStatus('Server assets stolen in 4K resolution!');
      }
    } catch (e: any) {
      setRobberStatus(`Error: ${e.message}`);
    } finally {
      setIsRobbing(false);
    }
  };

  const clearRobber = () => {
    setRobberResult(null);
    setRobberStatus('');
    setRobberTargetId('');
    setRobberGuildId('');
    setRobberFoundCandidates([]);
  };

  const toSnowflake = (date: string | number | Date) => {
    return String((BigInt(new Date(date).getTime()) - 1420070400000n) << 22n);
  };

  const handleDeleteMessages = async () => {
    if (!token || !currentUser || (!selectedTarget && deleteMode !== 'link')) {
      setDeleteStatus('Please select a target channel or provide a link.');
      return;
    }
    
    deletionStoppedRef.current = false;
    setIsDeleting(true);
    setDeleteStatus('Starting...');
    setDeleteLog([]);
    addDeleteLog('Starting deletion process...', 'info');

    let state = {
      delCount: 0,
      failCount: 0,
      offset: 0,
      grandTotal: 0
    };

    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

    const deleteSingleMessage = async (msg: any, attempt = 1): Promise<void> => {
      if (isDryRun) {
        state.delCount++;
        addDeleteLog(`🔍 [DRY RUN] Would delete message ${msg.id}`, 'info');
        setDeleteStatus(`Scanning... (${state.delCount} found)`);
        return;
      }
      try {
        const res = await fetch(`https://discord.com/api/v9/channels/${msg.channel_id}/messages/${msg.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': token }
        });

        if (res.status === 204) {
          state.delCount++;
          addDeleteLog(`✅ Deleted message ${msg.id}`, 'success');
          setDeleteStatus(`Deleting... (${state.delCount} done)`);
          return;
        }

        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = (data.retry_after || 5) * 1000;
          addDeleteLog(`⚠️ Rate limited on delete, waiting ${data.retry_after}s...`, 'warn');
          await wait(retryAfter * 2);
          if (attempt < 2) return deleteSingleMessage(msg, attempt + 1);
        }

        if (res.status === 400) {
          const data = await res.json();
          if (data.code === 50083) {
            addDeleteLog(`⏩ Skipping archived thread message ${msg.id}`, 'info');
            state.offset++;
            return;
          }
        }

        if (res.status === 404) {
          addDeleteLog(`⏩ Message ${msg.id} already deleted, skipping.`, 'info');
          return;
        }

        state.failCount++;
        const err = await res.json().catch(() => ({}));
        addDeleteLog(`❌ Failed to delete ${msg.id}: ${err.message || res.status}`, 'error');

      } catch (e: any) {
        state.failCount++;
        addDeleteLog(`❌ Error deleting ${msg.id}: ${e.message}`, 'error');
      }
    };

    try {
      if (deleteMode === 'link') {
        const parts = deleteStartLink.split('/');
        const msgId = parts.pop();
        const chanId = parts.pop();
        if (!msgId || !chanId) throw new Error('Invalid Discord message link');
        
        const res = await fetch(`https://discord.com/api/v9/channels/${chanId}/messages/${msgId}`, {
          method: 'DELETE',
          headers: { 'Authorization': token }
        });
        if (res.ok) {
          addDeleteLog(`✅ Deleted message ${msgId}`, 'success');
          setDeleteStatus('🧹 Deleted 1 message');
        } else {
          const err = await res.json().catch(() => ({}));
          addDeleteLog(`❌ Error: ${err.message || 'Failed'}`, 'error');
        }
        setIsDeleting(false);
        return;
      }

      if (deleteMode === 'count') {
        addDeleteLog(`Scanning channel for your messages...`, 'info');
        let messagesToDelete: any[] = [];
        let lastId: string | undefined = undefined;
        let targetChannelId = selectedTarget?.id || '';
        let totalScanned = 0;

        while (messagesToDelete.length < deleteCount && !deletionStoppedRef.current) {
          const url = lastId
            ? `https://discord.com/api/v9/channels/${targetChannelId}/messages?limit=100&before=${lastId}`
            : `https://discord.com/api/v9/channels/${targetChannelId}/messages?limit=100`;

          const res = await fetch(url, { headers: { 'Authorization': token } });
          
          if (res.status === 429) {
            const data = await res.json();
            const retryAfter = (data.retry_after || 5) * 1000;
            addDeleteLog(`⚠️ Rate limited on fetch, waiting ${data.retry_after}s...`, 'warn');
            await wait(retryAfter);
            continue;
          }

          if (!res.ok) {
             addDeleteLog(`❌ Error fetching messages: ${res.status}`, 'error');
             break;
          }
          
          const batch = await res.json();
          if (!Array.isArray(batch) || batch.length === 0) break;

          totalScanned += batch.length;
          for (const msg of batch) {
            const targetId = deleteTargetUserId || currentUser.id;
            if (msg.author.id === targetId) {
              if (!deleteIncludePinned && msg.pinned) continue;
              if (deleteOnlyAttachments && (!msg.attachments || msg.attachments.length === 0)) continue;
              if (deleteKeyword && !msg.content.toLowerCase().includes(deleteKeyword.toLowerCase())) continue;
              messagesToDelete.push(msg);
              if (messagesToDelete.length >= deleteCount) break;
            }
          }
          
          addDeleteLog(`Scanned ${totalScanned} messages, found ${messagesToDelete.length} of yours so far...`, 'info');
          
          if (batch.length < 100) break;
          
          lastId = batch[batch.length - 1].id;
          await wait(300);
        }

        if (messagesToDelete.length === 0) {
          addDeleteLog('No messages found to delete.', 'warn');
          setDeleteStatus('No messages found');
        } else {
          addDeleteLog(`Found ${messagesToDelete.length} of your messages. Starting deletion...`, 'info');
          for (const msg of messagesToDelete) {
            if (deletionStoppedRef.current) break;
            await deleteSingleMessage(msg);
            await wait(deleteDelay * 1000);
          }
          addDeleteLog(`🏁 Done — deleted ${state.delCount} messages`, 'success');
          setDeleteStatus(`🧹 Deleted ${state.delCount} messages`);
        }
        setIsDeleting(false);
        return;
      }

      // Mode 1 (ALL) and Mode 3 (DATE) using Search API
      const guildId = selectedTarget?.guild_id || '@me';
      const channelId = selectedTarget?.id;
      let searchDelay = 2000;

      while (!deletionStoppedRef.current) {
        const params = new URLSearchParams({
          author_id: currentUser.id,
          sort_by: 'timestamp',
          sort_order: 'desc',
          offset: state.offset.toString()
        });

        if (guildId !== '@me' && channelId) {
          params.append('channel_id', channelId);
        }

        if (deleteMode === 'date') {
          if (deleteStartDate) params.append('min_id', toSnowflake(deleteStartDate));
          if (deleteEndDate) params.append('max_id', toSnowflake(deleteEndDate));
        }

        if (deleteMode === 'keyword' && deleteKeyword) {
          params.append('content', deleteKeyword);
        }

        if (deleteMode === 'range') {
          const startId = deleteStartLink.split('/').pop();
          const endId = deleteEndLink.split('/').pop();
          if (startId) params.append('min_id', startId);
          if (endId) params.append('max_id', endId);
        }

        const searchUrl = guildId === '@me' 
          ? `https://discord.com/api/v9/channels/${channelId}/messages/search?${params}`
          : `https://discord.com/api/v9/guilds/${guildId}/messages/search?${params}`;

        const res = await fetch(searchUrl, { headers: { 'Authorization': token } });
        
        if (res.status === 202) {
          const data = await res.json();
          const retryAfter = (data.retry_after || 2) * 1000;
          addDeleteLog(`⏳ Search not indexed yet, retrying in ${data.retry_after}s...`, 'info');
          await wait(retryAfter);
          continue;
        }

        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = (data.retry_after || 5) * 1000;
          addDeleteLog(`⚠️ Search rate limited, waiting ${data.retry_after}s...`, 'warn');
          await wait(retryAfter * 2);
          continue;
        }

        if (!res.ok) {
          addDeleteLog(`❌ Search failed: ${res.status}`, 'error');
          break;
        }

        const data = await res.json();
        state.grandTotal = data.total_results;
        
        const discoveredMessages = data.messages?.map((m: any) => m.find((p: any) => p.hit)) || [];
        
        if (discoveredMessages.length === 0) {
          addDeleteLog('🏁 No more messages found.', 'success');
          break;
        }

        const targetId = deleteTargetUserId || currentUser.id;
        const messagesToDelete = discoveredMessages.filter((msg: any) => {
          if (!msg) return false;
          const isTarget = msg.author.id === targetId;
          const isDeletableType = msg.type === 0 || (msg.type >= 6 && msg.type <= 21);
          if (!deleteIncludePinned && msg.pinned) return false;
          if (deleteOnlyAttachments && (!msg.attachments || msg.attachments.length === 0)) return false;
          return isTarget && isDeletableType;
        });

        const skippedMessages = discoveredMessages.filter((msg: any) => !messagesToDelete.includes(msg));

        if (messagesToDelete.length > 0) {
          for (const msg of messagesToDelete) {
            if (deletionStoppedRef.current) break;
            await deleteSingleMessage(msg);
            await wait(deleteDelay * 1000);
          }
        } else if (skippedMessages.length > 0) {
          state.offset += skippedMessages.length;
          addDeleteLog(`⏩ Skipped ${skippedMessages.length} non-deletable messages on this page.`, 'info');
        } else {
          break;
        }

        await wait(searchDelay);
      }

      addDeleteLog(`🏁 Process finished. Deleted: ${state.delCount}, Failed: ${state.failCount}`, 'success');
      setDeleteStatus(`🧹 Deleted ${state.delCount} messages`);

    } catch (e: any) {
      console.error(e);
      addDeleteLog(`❌ Fatal error: ${e.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGcRename = async (name: string) => {
    if (!token || !gcId) return;
    try {
      const res = await fetch(`https://discord.com/api/v9/channels/${gcId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setGcStatus(`Renamed to: ${name}`);
      } else {
        const error = await res.json();
        if (res.status === 429) {
          setGcStatus(`Rate limited. Waiting ${error.retry_after}s...`);
          return error.retry_after;
        }
        setGcStatus(`Error: ${error.message || 'Failed'}`);
      }
    } catch (e) {
      console.error(e);
      setGcStatus('Connection error');
    }
    return 0;
  };

  const gcTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const runGcLoop = async () => {
      if ((gcLoop || gcCountdown) && token && gcId) {
        let delay = gcDelay;
        
        if (gcCountdown) {
          setGcCountdownStart(prev => {
            if (prev <= 0) {
              setGcCountdown(false);
              return 0;
            }
            handleGcRename(prev.toString());
            return prev - 1;
          });
        } else if (gcLoop) {
          let nameToSet = gcNewName;
          if (gcNewName.includes(',')) {
            const names = gcNewName.split(',').map(n => n.trim()).filter(n => n.length > 0);
            if (names.length > 0) {
              nameToSet = names[gcCurrentIndex % names.length];
              setGcCurrentIndex(prev => prev + 1);
            }
          }
          const retryAfter = await handleGcRename(nameToSet);
          if (retryAfter) {
            delay = retryAfter + 0.5; // Add a small buffer
          }
        }
        
        gcTimeoutRef.current = setTimeout(runGcLoop, delay * 1000);
      }
    };

    if (gcLoop || gcCountdown) {
      runGcLoop();
    } else {
      if (gcTimeoutRef.current) clearTimeout(gcTimeoutRef.current);
    }

    return () => {
      if (gcTimeoutRef.current) clearTimeout(gcTimeoutRef.current);
    };
  }, [gcLoop, gcCountdown, gcId, token, gcDelay, gcNewName]);

  // Anti AFK Logic
  useEffect(() => {
    if (antiAfkActive && token) {
      const seenIds = new Set<string>();
      antiAfkReplyIndexRef.current = 0;
      
      antiAfkIntervalRef.current = setInterval(async () => {
        try {
          let messages: any[] = [];
          if (antiAfkGuildId) {
            // Search guild-wide
            const res = await fetch(`https://discord.com/api/v9/guilds/${antiAfkGuildId}/messages/search?q=afk+check`, {
              headers: { 'Authorization': token }
            });
            if (res.ok) {
              const data = await res.json();
              messages = (data.messages || []).flat().filter((m: any) => m && m.id && m.content) || [];
            }
            
            // Also search for "vc check"
            const resVc = await fetch(`https://discord.com/api/v9/guilds/${antiAfkGuildId}/messages/search?q=vc+check`, {
              headers: { 'Authorization': token }
            });
            if (resVc.ok) {
              const dataVc = await resVc.json();
              const vcMsgs = (dataVc.messages || []).flat().filter((m: any) => m && m.id && m.content) || [];
              messages = [...messages, ...vcMsgs];
            }
          } else if (channelId) {
            const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages?limit=10`, {
              headers: { 'Authorization': token }
            });
            if (res.ok) {
              const data = await res.json();
              messages = Array.isArray(data) ? data : [];
            }
          }

          for (const msg of messages) {
            if (seenIds.has(msg.id)) continue;
            if (currentUser?.id && msg.author?.id === currentUser.id) {
              seenIds.add(msg.id);
              continue;
            }

            const content = msg.content.toLowerCase().replace(/[\s\W]/g, '');
            if (content.includes('afkcheck') || content.includes('vccheck')) {
              // Instant typing
              fetch(`https://discord.com/api/v9/channels/${msg.channel_id}/typing`, {
                method: 'POST',
                headers: { 'Authorization': token }
              }).catch(() => {});

              const replyPool = ["im here btw", "nope u cant afk check me son", "r u mad im still here btw", "im here. MANUAL BTW"];
              const custom = antiAfkCustomMessages.split(',').map(m => m.trim()).filter(m => m.length > 0);
              const pool = (!antiAfkUseDefault && custom.length > 0) ? custom : replyPool;
              const reply = pool[antiAfkReplyIndexRef.current % pool.length];
              antiAfkReplyIndexRef.current++;

              const actualDelay = Math.max(300, antiAfkDelay * 1000);
              setTimeout(async () => {
                await fetch(`https://discord.com/api/v9/channels/${msg.channel_id}/messages`, {
                  method: 'POST',
                  headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    content: reply,
                    message_reference: { message_id: msg.id }
                  })
                });
              }, actualDelay);
              
              seenIds.add(msg.id);
            } else {
              // If it doesn't match, still mark as seen so we don't re-process
              seenIds.add(msg.id);
            }
          }
        } catch (e) {
          console.error("Anti AFK error:", e);
        }
      }, 1500);
    } else {
      if (antiAfkIntervalRef.current) clearInterval(antiAfkIntervalRef.current);
    }
    return () => {
      if (antiAfkIntervalRef.current) clearInterval(antiAfkIntervalRef.current);
    };
  }, [antiAfkActive, token, channelId, antiAfkCustomMessages, antiAfkUseDefault, antiAfkGuildId, antiAfkDelay, currentUser]);

  // AutoBeefer Logic
  useEffect(() => {
    if (autobeeferActive) {
      autobeeferIntervalRef.current = setInterval(() => {
        const source = syncLists ? autobeeferMessages : autobeeferMessages;
        const available = source.filter((_, i) => !skippedIndices.has(i));
        
        if (available.length === 0) {
          setSkippedIndices(new Set());
          return;
        }

        const randomIndex = Math.floor(Math.random() * available.length);
        const msg = available[randomIndex];
        const originalIndex = source.indexOf(msg);

        setSkippedIndices(prev => new Set(prev).add(originalIndex));
        sendDiscordMessage(msg, 'autobeefer');
      }, delay * 1000);
    } else {
      if (autobeeferIntervalRef.current) clearInterval(autobeeferIntervalRef.current);
    }
    return () => {
      if (autobeeferIntervalRef.current) clearInterval(autobeeferIntervalRef.current);
    };
  }, [autobeeferActive, autobeeferMessages, delay, skippedIndices, syncLists]);

  // Legit Beefer Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!legitEnabled) return;
      
      const now = Date.now();
      const cooldown = 1000 / mps;
      
      if (e.key === triggerKey && now - lastTriggerTime.current > cooldown) {
        lastTriggerTime.current = now;
        
        const source = syncLists ? autobeeferMessages : legitMessages;
        if (source.length === 0) return;

        let msg = '';
        if (randomizeLegit) {
          msg = source[Math.floor(Math.random() * source.length)];
        } else {
          msg = source[currentLegitIndex % source.length];
          setCurrentLegitIndex(prev => prev + 1);
        }
        sendDiscordMessage(msg, 'legit');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [legitEnabled, triggerKey, mps, legitMessages, autobeeferMessages, syncLists, randomizeLegit, currentLegitIndex]);

  // Phrase Generator
  const generatePhrases = () => {
    setWlStatus('Generating...');
    const generated = new Set<string>();
    let attempts = 0;
    while (generated.size < wlAmount && attempts < wlAmount * 10) {
      const parts = [];
      const pools = [STARTERS, MODIFIERS, DESCRIPTORS, NOUNS, VERBS, INTENSIFIERS, TAUNTS, EXTRAS, CLOSERS];
      const numParts = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numParts; i++) {
        const pool = pools[Math.floor(Math.random() * pools.length)];
        parts.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      const phrase = parts.join(' ').trim();
      if (phrase.length > 5 && phrase.length < 100) generated.add(phrase);
      attempts++;
    }
    setWlOutput(Array.from(generated).join('\n'));
    setWlStatus(`Generated ${generated.size} unique phrases.`);
  };

  // GC Name Changer
  const changeGcName = async () => {
    if (!token || !gcId || !gcNewName) {
      setGcStatus('Missing information');
      return;
    }
    setGcStatus('Processing...');
    try {
      const res = await fetch(`https://discord.com/api/v9/channels/${gcId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: gcNewName })
      });
      if (res.ok) setGcStatus(`Success: Name changed to ${gcNewName}`);
      else setGcStatus('Failed to change name');
    } catch (e) {
      setGcStatus('Error occurred');
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'auto' | 'legit') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (target === 'auto') setAutobeeferMessages(lines);
      else setLegitMessages(lines);
      setSkippedIndices(new Set());
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen text-[#f5f5f5] font-mono selection:bg-red-500/30">
      <AnimatePresence>
        {showWelcomeNotif && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed top-4 right-4 z-[9999] bg-black border border-red-500 shadow-lg shadow-red-500/40 rounded-xl p-4 max-w-xs"
          >
            <p className="text-white text-xs sm:text-sm">
              Go to the Song Tab to listen to music—built for a better experience.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSongNotif && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed top-24 right-4 z-[9999] bg-black border border-red-500 shadow-lg shadow-red-500/40 rounded-xl p-4 max-w-xs"
          >
            <p className="text-white text-xs">
              Please unpause the music to play it—if it doesn't start, try again. Also there's a shuffle & repeat option, have fun!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!hasEntered && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35 }}
            className="splash-overlay"
          >
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-xl z-10">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/15 border border-red-500/40 text-[10px] tracking-widest uppercase font-bold text-red-400"
              >
                <Zap size={12} className="fill-red-500 text-red-500 animate-pulse" />
                <span>SLENDO CORD UTILITY SUITE</span>
              </motion.div>

              <motion.h1 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="splash-title text-4xl sm:text-6xl font-bold uppercase tracking-wider text-red-500 font-display mb-2 drop-shadow-[0_0_25px_rgba(239,68,68,0.7)]"
              >
                SLENDO CORD
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-xs sm:text-sm font-mono text-white/60 mb-8 tracking-widest uppercase"
              >
                SLENDO X SEB CORD
              </motion.p>

              <motion.button 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleEnter}
                className="enter-button text-sm sm:text-base font-bold tracking-widest px-8 py-3.5 rounded-xl border border-red-500 bg-red-600/20 hover:bg-red-600 text-white shadow-xl shadow-red-600/40 transition-all cursor-pointer font-display"
              >
                CLICK HERE TO START
              </motion.button>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mt-6 text-[10px] font-mono text-white/40 tracking-wider"
              >
                Click to unlock all modules, audio engine, and Discord automation tools
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5% Blurred YouTube Video Background */}
      <div 
        className="fixed inset-0 pointer-events-none select-none overflow-hidden -z-10 bg-[#050508]" 
        aria-hidden="true"
      >
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            filter: 'blur(5px)',
            WebkitFilter: 'blur(5px)',
            transform: 'scale(1.15)',
          }}
        >
          {/* Responsive 16:9 container that covers 100% of viewport without letterboxing */}
          <div className="w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] relative pointer-events-none">
            <div id="youtube-player-api" className="w-full h-full pointer-events-none absolute inset-0"></div>
          </div>
        </div>
        {/* Subtle Dark Vignette overlay to keep UI elements, cards, and text easily readable */}
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />
      </div>

      {/* Header */}
      <header className="border-b border-red-500/20 bg-black/60 backdrop-blur-md sticky top-0 z-50">
        <div className="relative max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-md shadow-red-500/30">
              <Zap size={18} className="fill-red-500 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tighter uppercase italic font-display text-red-500 leading-none">
                SLENDO CORD
              </h1>
              <p className="text-[9px] font-mono tracking-widest text-white/40 uppercase">
                SLENDO X SEB
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 lg:flex">
            <form onSubmit={(e) => { e.preventDefault(); handleSearch('header'); }} className={`relative transition-[width] duration-300 ${searchQuery ? 'w-72' : 'w-44'}`}>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#141016]/90 px-3 shadow-[0_8px_28px_rgba(0,0,0,.35)] transition focus-within:border-red-400/50 focus-within:shadow-[0_0_28px_rgba(239,68,68,.15)]">
                <Search size={15} className="shrink-0 text-red-300/70" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search YouTube" className="w-full bg-transparent px-2.5 py-2.5 text-xs text-white outline-none placeholder:text-white/30" />
                {searchQuery && <button type="submit" disabled={isSearching} className="rounded-lg bg-red-500/15 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-red-200 transition hover:bg-red-500/30 disabled:opacity-50">{isSearching ? '…' : 'Go'}</button>}
              </div>
              {renderVideoResults('header')}
            </form>

            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-[#100d13]/95 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,.4)] backdrop-blur-xl">
              <button onClick={handlePrevious} title="Previous song" className="flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"><SkipBack size={14} /></button>
              <button onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/20 text-red-200 shadow-[0_0_18px_rgba(239,68,68,.14)] transition hover:bg-red-500/35">{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button>
              <button onClick={handleSkip} title="Skip to next song" className="flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"><SkipForward size={15} /></button>
              <button onClick={toggleRepeat} title={loopMode ? 'Turn song loop off' : 'Loop current song'} className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${loopMode ? 'bg-red-500/20 text-red-200' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}><Repeat size={14} /></button>
              <span className="mx-1 h-5 w-px bg-white/10" />
              <button onClick={toggleMute} title={isMuted || volume === 0 ? 'Unmute' : 'Mute'} className="flex h-8 w-7 items-center justify-center text-white/50 transition hover:text-white">{isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
              <input aria-label="Volume" title={`Volume ${isMuted ? 0 : volume}%`} type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="mr-1 w-14 accent-red-400" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHasEntered(false)}
              className="text-[10px] uppercase font-bold text-white/40 hover:text-red-400 px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/40 bg-white/5 transition-all flex items-center gap-1.5"
              title="Return to start page"
            >
              <Zap size={10} className="text-red-500" />
              <span>Start Page</span>
            </button>
            {currentUser ? (
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden">
                  {currentUser.avatar ? (
                    <img src={`https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`} alt="" />
                  ) : (
                    <User size={12} />
                  )}
                </div>
                <span className="text-xs font-medium">{currentUser.username}</span>
              </div>
            ) : (
              <div
                className={`text-[10px] uppercase tracking-widest ${
                  tokenStatus === 'rejected' || tokenStatus === 'session-expired' || tokenStatus === 'unavailable'
                    ? 'text-amber-300'
                    : 'text-white/40'
                }`}
                role="status"
                aria-live="polite"
              >
                {tokenStatus === 'checking' && 'Checking Token'}
                {tokenStatus === 'rejected' && 'Discord 401'}
                {tokenStatus === 'session-expired' && 'App Session Expired'}
                {tokenStatus === 'unavailable' && 'API Request Failed'}
                {tokenStatus === 'idle' && 'Not Connected'}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar Navigation */}
        <nav className="space-y-1">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 px-3">Categories</div>
          {NAV_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            const isOpen = !collapsedCategories.has(category.id);
            return (
              <div key={category.id} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={isOpen}
                  aria-controls={`nav-category-${category.id}`}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-200"
                >
                  <CategoryIcon size={12} className="text-red-500/70" />
                  <span>{category.label}</span>
                  <span className="ml-auto text-white/30">
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`nav-category-${category.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 pt-1 pb-1">
                        {category.items.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id);
                              if (tab.id === 'song') {
                                setShowSongNotif(true);
                                const audio = new Audio('https://www.myinstants.com/media/sounds/discord-notification.mp3');
                                audio.volume = 0.5;
                                audio.play().catch(e => console.error("Audio play failed:", e));
                                setTimeout(() => setShowSongNotif(false), 5000);
                              }
                            }}
                            className={`w-full flex items-center gap-3 pl-5 pr-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                              activeTab === tab.id
                                ? 'bg-red-700 text-white shadow-lg shadow-red-600/20'
                                : 'text-white/50 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <tab.icon size={16} className={activeTab === tab.id ? 'text-white' : 'text-white/40 group-hover:text-white'} />
                            <span className="font-medium">{tab.label}</span>
                            {activeTab === tab.id && (
                              <motion.div layoutId="active-pill" className="ml-auto">
                                <ChevronRight size={14} />
                              </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="space-y-6">
          {/* Global Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/60 p-6 rounded-2xl border border-red-500/20 backdrop-blur-sm glass-card">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-red-500/60 tracking-wider flex items-center gap-2">
                <Zap size={10} /> User Token
              </label>
              <input 
                type="password"
                value={token}
                onChange={(e) => setToken(normalizeDiscordToken(e.target.value))}
                placeholder="Enter Discord Token..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
              {tokenStatus !== 'idle' && (
                <p
                  className={`text-[10px] ${
                    tokenStatus === 'connected'
                      ? 'text-emerald-400'
                      : tokenStatus === 'checking'
                        ? 'text-white/40'
                        : 'text-amber-300'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {tokenStatus === 'checking' && 'Checking Discord connection…'}
                  {tokenStatus === 'connected' && 'Discord account connected.'}
                  {tokenStatus === 'rejected' && 'Discord rejected this token (401). Copy it again from a fresh login.'}
                  {tokenStatus === 'session-expired' && 'App sign-in expired; sign in again to use the proxy.'}
                  {tokenStatus === 'unavailable' && 'Could not reach Discord from this browser. Check your connection and try again.'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-red-500/60 tracking-wider flex items-center gap-2">
                <Hash size={10} /> Channel ID
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="Enter Target Channel ID..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                />
                <button 
                  onClick={() => setActiveTab('channels')}
                  className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-500 transition-all"
                  title="Select from list"
                >
                  <Hash size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-red-500/60 tracking-wider flex items-center gap-2">
                <User size={10} /> User ID
              </label>
              <input 
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab !== 'song' && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-black/60 rounded-2xl border border-red-500/20 p-6 min-h-[400px] glass-card"
                >
                  {activeTab === 'channels' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h2 className="text-xl font-bold italic font-display text-red-500">Channel Picker</h2>
                        <div className="flex gap-2">
                          <button 
                            onClick={refreshDms}
                            disabled={isRefreshingDms}
                            className={`p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${isRefreshingDms ? 'animate-spin text-red-500' : 'text-white/40 hover:text-white'}`}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button 
                            onClick={refreshGuilds}
                            disabled={isRefreshingGuilds}
                            className={`p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${isRefreshingGuilds ? 'animate-spin text-red-500' : 'text-white/40 hover:text-white'}`}
                          >
                            <Server size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* DMs Column */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-white/40 px-2">
                            <User size={12} /> Direct Messages
                          </div>
                          <div className="relative">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                            <input 
                              type="text"
                              value={dmSearch}
                              onChange={(e) => setDmSearch(e.target.value)}
                              placeholder="Search DMs..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-[10px] focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                            {dms.length === 0 ? (
                              <div className="p-8 text-center text-white/20 text-xs">No DMs found.</div>
                            ) : (
                              dms.filter(dm => {
                                const search = dmSearch.toLowerCase();
                                const username = (dm.recipients?.[0]?.username || '').toLowerCase();
                                return username.includes(search) || dm.id.includes(search);
                              }).map(dm => (
                                <button
                                  key={dm.id}
                                  onClick={() => {
                                    setChannelId(dm.id);
                                    setGcId(dm.id);
                                    setSelectedTarget({ id: dm.id, name: dm.recipients?.[0]?.username || 'Group DM', type: 'dm' });
                                  }}
                                  className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left ${channelId === dm.id ? 'bg-red-500/10 border-l-2 border-l-red-500' : ''}`}
                                >
                                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                    {dm.recipients?.[0]?.avatar ? (
                                      <img src={`https://cdn.discordapp.com/avatars/${dm.recipients[0].id}/${dm.recipients[0].avatar}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User size={16} className="text-white/40" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{dm.recipients?.[0]?.username || 'Group DM'}</p>
                                    <p className="text-[10px] text-white/40 truncate">ID: {dm.id}</p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Servers Column */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-white/40 px-2">
                            <Server size={12} /> Servers
                          </div>
                          <div className="relative">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                            <input 
                              type="text"
                              value={guildSearch}
                              onChange={(e) => setGuildSearch(e.target.value)}
                              placeholder="Search Servers..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-[10px] focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                            {guilds.length === 0 ? (
                              <div className="p-8 text-center text-white/20 text-xs">No servers found.</div>
                            ) : (
                              guilds.filter(guild => {
                                const search = guildSearch.toLowerCase();
                                return guild.name.toLowerCase().includes(search) || guild.id.includes(search);
                              }).map(guild => (
                                <div key={guild.id} className="border-b border-white/5 last:border-0">
                                  <button
                                    onClick={() => {
                                      if (selectedGuildId === guild.id) {
                                        setSelectedGuildId(null);
                                      } else {
                                        setSelectedGuildId(guild.id);
                                        fetchGuildChannels(guild.id);
                                      }
                                    }}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                                      {guild.icon ? (
                                        <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        <span className="text-[10px] font-bold text-white/40">{guild.name.charAt(0)}</span>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-white truncate">{guild.name}</p>
                                    </div>
                                    <ChevronRight size={14} className={`text-white/20 transition-transform ${selectedGuildId === guild.id ? 'rotate-90' : ''}`} />
                                  </button>
                                  {selectedGuildId === guild.id && (
                                    <div className="bg-black/20 py-2 px-4 space-y-1">
                                      {selectedGuildChannels.length === 0 ? (
                                        <p className="text-[10px] text-white/20 p-2">Loading channels...</p>
                                      ) : (
                                        selectedGuildChannels.map(channel => (
                                          <button
                                            key={channel.id}
                                            onClick={() => {
                                              setChannelId(channel.id);
                                              setSelectedTarget({ id: channel.id, name: channel.name, type: 'channel' });
                                            }}
                                            className={`w-full flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg transition-colors text-left ${channelId === channel.id ? 'bg-red-500/10 text-red-500' : 'text-white/60'}`}
                                          >
                                            <Hash size={12} />
                                            <span className="text-[10px] font-medium truncate">{channel.name}</span>
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'normal' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">Normal Typing</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setTextCase(prev => prev === 'upper' ? 'none' : 'upper')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${textCase === 'upper' ? 'bg-red-700 border-red-500 text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                      >
                        UPPER
                      </button>
                      <button 
                        onClick={() => setTextCase(prev => prev === 'lower' ? 'none' : 'lower')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${textCase === 'lower' ? 'bg-red-700 border-red-500 text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                      >
                        lower
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Target Info */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                          {selectedTarget?.type === 'dm' ? <User size={20} /> : <Hash size={20} />}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-red-500/60">Targeting</p>
                          <p className="text-sm font-bold text-white">{selectedTarget?.name || 'No Target Selected'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('channels')}
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                      >
                        <RefreshCw size={12} /> Change
                      </button>
                    </div>
                    {/* Auto Quote Section */}
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Quote size={14} className="text-red-500" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white/60">Auto Quote</span>
                        </div>
                        <button 
                          onClick={() => setAutoQuoteEnabled(!autoQuoteEnabled)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${autoQuoteEnabled ? 'bg-red-700 text-white' : 'bg-white/5 text-white/40 border border-white/10'}`}
                        >
                          {autoQuoteEnabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>
                      
                      {autoQuoteEnabled && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/40">User ID to Quote</label>
                            <input 
                              type="text"
                              value={quoteUserId}
                              onChange={(e) => setQuoteUserId(e.target.value)}
                              placeholder="Enter User ID..."
                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/40">Your Response</label>
                            <textarea 
                              value={quoteMessage}
                              onChange={(e) => setQuoteMessage(e.target.value)}
                              placeholder="Type your response..."
                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-red-500/50 h-20 resize-none"
                            />
                          </div>
                          <button 
                            onClick={async () => {
                              if (!token || !channelId || !quoteUserId) return;
                              try {
                                const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages?limit=50`, {
                                  headers: { 'Authorization': token }
                                });
                                if (response.ok) {
                                  const messages = await response.json();
                                  const userMsg = messages.find((m: any) => m.author.id === quoteUserId);
                                  if (userMsg) {
                                    const fullMsg = `"${userMsg.content}" ${quoteMessage}`;
                                    await sendDiscordMessage(fullMsg, 'normal');
                                    setQuoteMessage('');
                                  } else {
                                    alert('No recent message found from this user');
                                  }
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="w-full py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 transition-all"
                          >
                            SEND QUOTE
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">User ID to Ping</label>
                        <input 
                          type="text"
                          value={userPing}
                          onChange={(e) => setUserPing(e.target.value)}
                          placeholder="Optional..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Random Effects</label>
                        <button 
                          onClick={() => setRandomEffects(!randomEffects)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${randomEffects ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                        >
                          <span className="text-sm font-medium">Enable Random Effects</span>
                          <div className={`w-4 h-4 rounded-full border-2 ${randomEffects ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40">Message Content</label>
                      <textarea 
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          if (token && channelId && Date.now() - lastTypingIndicatorTime.current > 8000) {
                            lastTypingIndicatorTime.current = Date.now();
                            fetch(`https://discord.com/api/v9/channels/${channelId}/typing`, {
                              method: 'POST',
                              headers: { 'Authorization': token }
                            }).catch(() => {});
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendDiscordMessage(message);
                            setMessage('');
                          }
                        }}
                        placeholder="Type your message... (Enter to send)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 min-h-[120px] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Prefix</label>
                        <input 
                          type="text"
                          value={startMsg}
                          onChange={(e) => setStartMsg(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Suffix</label>
                        <input 
                          type="text"
                          value={endMsg}
                          onChange={(e) => setEndMsg(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        sendDiscordMessage(message);
                        setMessage('');
                      }}
                      className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={18} /> Send Message
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'mass-dm' && (() => {
                const query = massDmSearch.trim().toLowerCase();
                const filteredFriends = friends.filter((rel) => {
                  if (!query) return true;
                  const u = rel.user;
                  const uname = (u.username || '').toLowerCase();
                  const gname = (u.global_name || u.display_name || '').toLowerCase();
                  const nick = (rel.nickname || '').toLowerCase();
                  return uname.includes(query) || gname.includes(query) || nick.includes(query) || u.id.includes(query);
                });
                const filteredIds = filteredFriends.map(f => f.user.id);
                const selectedFilteredCount = filteredIds.filter(id => selectedFriendIds.has(id)).length;
                const progressPercent = massDmProgress.total > 0 ? Math.round((massDmProgress.current / massDmProgress.total) * 100) : 0;

                return (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold italic font-display text-red-500">Mass DM</h2>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                            Anti-Spam • {massDmDelay.toFixed(1)}s + Typing
                          </span>
                        </div>
                        <p className="text-xs text-white/40 font-mono mt-0.5">
                          Send a message or image to selected friends with a {massDmDelay.toFixed(1)}s typing delay per DM
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!massDmActive ? (
                          <button
                            onClick={handleStartMassDm}
                            disabled={selectedFriendIds.size === 0 || (!massDmMessage.trim() && !massDmImageFile)}
                            className="px-5 py-2 bg-red-700 hover:bg-red-600 active:scale-95 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <Send size={14} />
                            <span>Start Mass DM ({selectedFriendIds.size})</span>
                          </button>
                        ) : (
                          <button
                            onClick={handleStopMassDm}
                            className="px-5 py-2 bg-white/10 hover:bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider border border-red-500/40 transition-all flex items-center gap-2"
                          >
                            <Square size={14} className="fill-white" />
                            <span>Stop</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Message & Image Composer */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="space-y-3 bg-black/40 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold text-white/50">
                            DM Message (Optional if Image Attached)
                          </label>
                          <span className="text-[9px] font-mono text-white/30">
                            {massDmMessage.length} chars
                          </span>
                        </div>
                        <textarea
                          value={massDmMessage}
                          onChange={(e) => setMassDmMessage(e.target.value)}
                          onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (!items) return;
                            for (const item of items) {
                              if (item.type.startsWith('image/')) {
                                const file = item.getAsFile();
                                if (file) {
                                  handleMassDmImageChange(file);
                                }
                                break;
                              }
                            }
                          }}
                          disabled={massDmActive}
                          placeholder="Type the message to send to selected friends... (You can also paste an image here)"
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50 min-h-[120px] resize-none disabled:opacity-50"
                        />

                        {/* Anti-spam Timing & Typing Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-white/50 flex items-center gap-1.5">
                                <Clock size={12} className="text-red-500" />
                                <span>DM Delay</span>
                              </span>
                              <span className="text-xs font-mono font-bold text-red-400">
                                {massDmDelay.toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={3}
                              max={15}
                              step={0.5}
                              value={massDmDelay}
                              disabled={massDmActive}
                              onChange={(e) => setMassDmDelay(Math.max(3, parseFloat(e.target.value)))}
                              className="w-full accent-red-600 cursor-pointer"
                            />
                            <p className="text-[9px] text-white/30">Min 3.0s delay between DMs (no instant spam)</p>
                          </div>

                          <button
                            type="button"
                            disabled={massDmActive}
                            onClick={() => setMassDmTypingIndicator(!massDmTypingIndicator)}
                            className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all disabled:opacity-50 ${
                              massDmTypingIndicator
                                ? 'bg-red-700/15 border-red-500/50 text-white'
                                : 'bg-black/50 border-white/10 text-white/40'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] uppercase font-bold tracking-wider">
                                Typing Indicator
                              </span>
                              <div className={`w-3.5 h-3.5 rounded-full border-2 ${massDmTypingIndicator ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                            </div>
                            <span className="text-[10px] text-white/50 mt-2">
                              {massDmTypingIndicator ? 'Shows "typing..." for 3s+ before sending' : 'Disabled (Wait only)'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Image Attachment Box */}
                      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold text-white/50 flex items-center gap-1.5">
                            <ImageIcon size={12} className="text-red-500" />
                            <span>Image Attachment (Optional)</span>
                          </label>
                          {massDmImageFile && (
                            <button
                              type="button"
                              disabled={massDmActive}
                              onClick={() => handleMassDmImageChange(null)}
                              className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                            >
                              <X size={12} /> Remove
                            </button>
                          )}
                        </div>

                        {massDmImagePreview && massDmImageFile ? (
                          <div className="flex-1 flex flex-col items-center justify-center bg-black/60 border border-white/10 rounded-xl p-3 space-y-2 overflow-hidden">
                            <img
                              src={massDmImagePreview}
                              alt="Attachment preview"
                              className="max-h-40 rounded-lg object-contain border border-white/10"
                            />
                            <div className="text-center">
                              <p className="text-xs font-mono text-white/80 truncate max-w-[260px]">
                                {massDmImageFile.name}
                              </p>
                              <p className="text-[10px] text-white/40">
                                {(massDmImageFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                        ) : (
                          <label className="flex-1 min-h-[160px] flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-red-500/40 bg-black/40 hover:bg-red-500/5 rounded-xl p-6 cursor-pointer transition-all text-center group">
                            <Upload size={26} className="text-white/25 group-hover:text-red-400 transition-colors mb-2" />
                            <span className="text-xs font-bold text-white/60 group-hover:text-white">
                              Click to Upload Image
                            </span>
                            <span className="text-[10px] text-white/30 mt-1">
                              PNG, JPG, GIF, WEBP (up to 25MB)
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={massDmActive}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                handleMassDmImageChange(file);
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Friends List Selection Panel */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Users size={15} className="text-red-500" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            Friends List ({friends.length})
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-red-600/20 border border-red-500/30 text-[10px] font-mono font-bold text-red-400">
                            {selectedFriendIds.size} selected
                          </span>
                          {selectedFriendIds.size > 0 && (
                            <span className="text-[10px] font-mono text-white/40 hidden sm:inline">
                              (~{Math.round(selectedFriendIds.size * massDmDelay)}s est.)
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={refreshFriends}
                            disabled={isRefreshingFriends || massDmActive || !token}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase text-white/70 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40"
                          >
                            <RotateCcw size={11} className={isRefreshingFriends ? 'animate-spin text-red-400' : ''} />
                            <span>Refresh</span>
                          </button>

                          <button
                            type="button"
                            onClick={selectAllFriends}
                            disabled={friends.length === 0 || massDmActive}
                            className="px-3 py-1.5 rounded-lg bg-red-700/25 hover:bg-red-700/40 border border-red-500/40 text-[10px] font-bold uppercase text-red-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40"
                          >
                            <CheckSquare size={11} />
                            <span>Select All Friends ({friends.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={unselectAllFriends}
                            disabled={selectedFriendIds.size === 0 || massDmActive}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase text-white/60 hover:text-white transition-all disabled:opacity-40"
                          >
                            Unselect All
                          </button>
                        </div>
                      </div>

                      {/* Search Bar + Filtered Quick Toggle */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                          <input
                            type="text"
                            value={massDmSearch}
                            onChange={(e) => setMassDmSearch(e.target.value)}
                            placeholder="Search friends by username, display name, or ID to select / unselect..."
                            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50"
                          />
                          {massDmSearch && (
                            <button
                              type="button"
                              onClick={() => setMassDmSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {query && filteredFriends.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={massDmActive}
                              onClick={() => selectFilteredFriends(filteredIds)}
                              className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-[10px] font-bold uppercase text-red-300 transition-all"
                            >
                              Select Matches ({filteredFriends.length})
                            </button>
                            <button
                              type="button"
                              disabled={massDmActive || selectedFilteredCount === 0}
                              onClick={() => unselectFilteredFriends(filteredIds)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase text-white/60 hover:text-white transition-all disabled:opacity-40"
                            >
                              Unselect Matches ({selectedFilteredCount})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Scrollable Friends List */}
                      <div className="bg-black/50 border border-white/5 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                        {!token ? (
                          <div className="p-8 text-center text-white/30 text-xs">
                            Enter your Discord User Token above to load your friends list.
                          </div>
                        ) : friends.length === 0 ? (
                          <div className="p-8 text-center text-white/30 text-xs space-y-2">
                            <p>{isRefreshingFriends ? 'Loading friends list...' : 'No friends found in your relationships list.'}</p>
                            {!isRefreshingFriends && (
                              <button
                                type="button"
                                onClick={refreshFriends}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-[10px] uppercase font-bold border border-white/10"
                              >
                                Retry Fetch Friends
                              </button>
                            )}
                          </div>
                        ) : filteredFriends.length === 0 ? (
                          <div className="p-8 text-center text-white/30 text-xs">
                            No friends matching "{massDmSearch}".
                          </div>
                        ) : (
                          filteredFriends.map((rel) => {
                            const friend = rel.user;
                            const isSelected = selectedFriendIds.has(friend.id);
                            const displayName = rel.nickname || friend.global_name || friend.display_name || friend.username;
                            return (
                              <button
                                key={friend.id}
                                type="button"
                                disabled={massDmActive}
                                onClick={() => toggleFriendSelection(friend.id)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all ${
                                  isSelected
                                    ? 'bg-red-700/15 hover:bg-red-700/20'
                                    : 'hover:bg-white/[0.03]'
                                } disabled:opacity-60`}
                              >
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                                    isSelected
                                      ? 'bg-red-600 border-red-500 text-white'
                                      : 'border-white/25 bg-black/40'
                                  }`}
                                >
                                  {isSelected && <Check size={11} strokeWidth={3} />}
                                </div>

                                <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                  {friend.avatar ? (
                                    <img
                                      src={`https://cdn.discordapp.com/avatars/${friend.id}/${friend.avatar}.png?size=128`}
                                      alt={friend.username}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <User size={15} className="text-white/40" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                      {displayName}
                                    </span>
                                    <span className="text-[10px] font-mono text-white/40 truncate">
                                      @{friend.username}
                                    </span>
                                  </div>
                                  <p className="text-[9px] font-mono text-white/30 truncate">
                                    ID: {friend.id}
                                  </p>
                                </div>

                                <span
                                  className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    isSelected
                                      ? 'bg-red-600/20 text-red-400 border-red-500/30'
                                      : 'bg-white/5 text-white/30 border-white/10'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Excluded'}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Progress & Live Activity Log */}
                    {(massDmStatus || massDmLogs.length > 0) && (
                      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-red-400 font-bold">{massDmStatus || 'Ready'}</span>
                          {massDmProgress.total > 0 && (
                            <span className="text-white/60">
                              {massDmProgress.current}/{massDmProgress.total} ({progressPercent}%) • Sent: {massDmProgress.sent} • Failed: {massDmProgress.failed}
                            </span>
                          )}
                        </div>

                        {massDmProgress.total > 0 && (
                          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                            <div
                              className="h-full bg-red-600 transition-all duration-200"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        )}

                        {massDmLogs.length > 0 && (
                          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-black/60 rounded-xl p-3 border border-white/5 font-mono text-[11px]">
                            {massDmLogs.map((log, idx) => (
                              <div
                                key={idx}
                                className={`flex items-start gap-2 ${
                                  log.type === 'success'
                                    ? 'text-emerald-400'
                                    : log.type === 'warn'
                                    ? 'text-amber-400'
                                    : log.type === 'error'
                                    ? 'text-red-400'
                                    : 'text-white/60'
                                }`}
                              >
                                <span className="text-white/30 shrink-0">[{log.time}]</span>
                                <span>{log.msg}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeTab === 'force-nickname' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">Force Nickname</h2>
                    <button
                      onClick={() => setForceNickActive(!forceNickActive)}
                      disabled={!forceNickGuildId || !forceNickName}
                      className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${forceNickActive ? 'bg-red-700 text-white shadow-red-600/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/10'}`}
                    >
                      {forceNickActive ? '🔒 FORCING...' : 'START FORCE'}
                    </button>
                  </div>

                  {/* Server picker — reuse the existing guilds state */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/40">Select Server</label>
                    <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden max-h-[260px] overflow-y-auto custom-scrollbar">
                      {guilds.length === 0 ? (
                        <div className="p-8 text-center text-white/20 text-xs">No servers found. Enter token first.</div>
                      ) : (
                        guilds.map(guild => (
                          <button
                            key={guild.id}
                            onClick={() => {
                              setForceNickGuildId(guild.id);
                              setForceNickGuildName(guild.name);
                              setForceNickActive(false);
                            }}
                            className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left ${forceNickGuildId === guild.id ? 'bg-red-700/10 border-red-500/20' : ''}`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {guild.icon ? (
                                <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[10px] font-bold text-white/40">{guild.name.charAt(0)}</span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-white truncate flex-1">{guild.name}</span>
                            {forceNickGuildId === guild.id && (
                              <span className="text-[10px] text-red-400 font-bold flex-shrink-0">SELECTED</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Selected server preview */}
                  {forceNickGuildId && (
                    <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                        {guilds.find(g => g.id === forceNickGuildId)?.icon ? (
                          <img src={`https://cdn.discordapp.com/icons/${forceNickGuildId}/${guilds.find(g => g.id === forceNickGuildId)?.icon}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/40">{forceNickGuildName.charAt(0)}</div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-red-500/60">Target Server</p>
                        <p className="text-sm font-bold text-white">{forceNickGuildName}</p>
                      </div>
                    </div>
                  )}

                  {/* Nickname input */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/40">Forced Nickname</label>
                    <input
                      type="text"
                      value={forceNickName}
                      onChange={(e) => setForceNickName(e.target.value)}
                      placeholder="Enter the nickname to lock to..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>

                  {/* Status */}
                  {forceNickStatus && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs font-mono text-red-400">
                      {forceNickStatus}
                    </div>
                  )}

                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <p className="text-[10px] text-red-500/60 leading-relaxed">
                      Checks your nickname every 800ms. If anyone changes it, it instantly forces it back to your chosen name. Select a server, type your nickname, then hit START FORCE.
                    </p>
                  </div>

                  {/* DIVIDER */}
                  <div className="border-t border-white/10 pt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold italic font-display text-red-500">Force Nickname Others</h3>
                      <button
                        onClick={() => setForceOtherActive(!forceOtherActive)}
                        disabled={!forceOtherGuildId || !forceOtherUserId || !forceOtherNickName}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${forceOtherActive ? 'bg-red-700 text-white shadow-red-600/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/10'}`}
                      >
                        {forceOtherActive ? '🔒 FORCING...' : 'START FORCE'}
                      </button>
                    </div>

                    {/* User ID + Nickname inputs side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Target User ID</label>
                        <input
                          type="text"
                          value={forceOtherUserId}
                          onChange={(e) => setForceOtherUserId(e.target.value)}
                          placeholder="Enter User ID to target..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Custom Nickname</label>
                        <input
                          type="text"
                          value={forceOtherNickName}
                          onChange={(e) => setForceOtherNickName(e.target.value)}
                          placeholder="Nickname to force on them..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Server picker */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40">Select Server</label>
                      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar">
                        {guilds.length === 0 ? (
                          <div className="p-8 text-center text-white/20 text-xs">No servers found. Enter token first.</div>
                        ) : (
                          guilds.map(guild => (
                            <button
                              key={guild.id}
                              onClick={() => {
                                setForceOtherGuildId(guild.id);
                                setForceOtherGuildName(guild.name);
                                setForceOtherActive(false);
                              }}
                              className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left ${forceOtherGuildId === guild.id ? 'bg-red-700/10 border-red-500/20' : ''}`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {guild.icon ? (
                                  <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-[10px] font-bold text-white/40">{guild.name.charAt(0)}</span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-white truncate flex-1">{guild.name}</span>
                              {forceOtherGuildId === guild.id && (
                                <span className="text-[10px] text-red-400 font-bold flex-shrink-0">SELECTED</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Selected server preview */}
                    {forceOtherGuildId && (
                      <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                          {guilds.find(g => g.id === forceOtherGuildId)?.icon ? (
                            <img src={`https://cdn.discordapp.com/icons/${forceOtherGuildId}/${guilds.find(g => g.id === forceOtherGuildId)?.icon}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/40">{forceOtherGuildName.charAt(0)}</div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-red-500/60">Target Server</p>
                          <p className="text-sm font-bold text-white">{forceOtherGuildName}</p>
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    {forceOtherStatus && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs font-mono text-red-400">
                        {forceOtherStatus}
                      </div>
                    )}

                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                      <p className="text-[10px] text-red-500/60 leading-relaxed">
                        Forces a custom nickname onto another user every 800ms. If they remove it or change it, it instantly forces it back. Requires you to have permission to manage nicknames in the server.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'robber' && (
                <div className="space-y-6">
                  {/* Robber Header */}
                  <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold italic font-display text-red-500">Robber</h2>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                          4K Asset Stealer
                        </span>
                      </div>
                      <p className="text-xs text-white/40 font-mono mt-0.5">
                        Find user IDs, profile pictures, and banners in uncompressed 4K resolution (4096px)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button 
                        onClick={() => handleRobber()}
                        disabled={isRobbing}
                        className="px-5 py-2 bg-red-700 hover:bg-red-600 active:scale-95 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isRobbing ? (
                          <>
                            <RefreshCw size={14} className="animate-spin text-white" />
                            <span>Stealing...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} className="fill-white text-white" />
                            <span>Steal Assets</span>
                          </>
                        )}
                      </button>
                      <button 
                        onClick={clearRobber}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider border border-white/10 transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Input Controls */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-white/50 flex items-center justify-between">
                          <span>User ID, Username, or Link</span>
                          <span className="text-[9px] text-white/30 lowercase">accepts ID, @user, or profile URL</span>
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            value={robberTargetId}
                            onChange={(e) => setRobberTargetId(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRobber();
                            }}
                            placeholder="e.g. 104875638291029384, @slendo, or discord.com/users/..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50 transition-all font-mono"
                          />
                          {robberTargetId && (
                            <button
                              onClick={() => setRobberTargetId('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-white/50 flex items-center justify-between">
                          <span>Guild ID (Optional)</span>
                          <span className="text-[9px] text-white/30 lowercase">for server avatar & banner</span>
                        </label>
                        <input 
                          type="text"
                          value={robberGuildId}
                          onChange={(e) => setRobberGuildId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRobber();
                          }}
                          placeholder="Target Server / Guild ID"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Quick Selection from loaded DMs */}
                    {dms.length > 0 && (
                      <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] uppercase font-bold text-white/50 flex items-center gap-1.5">
                            <Users size={12} className="text-red-500" />
                            <span>Quick Select User from Recent DMs / Friends</span>
                          </label>
                          <span className="text-[9px] text-white/30">{dms.length} loaded</span>
                        </div>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setRobberTargetId(e.target.value);
                              handleRobber(e.target.value);
                            }
                          }}
                          value=""
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-red-500/50 cursor-pointer"
                        >
                          <option value="">-- Click to choose any user from your DMs --</option>
                          {dms
                            .filter((c: any) => c.recipients && c.recipients.length > 0)
                            .map((c: any) => {
                              const r = c.recipients[0];
                              const displayName = r.global_name || r.display_name || r.username;
                              return (
                                <option key={c.id} value={r.id}>
                                  {displayName} (@{r.username}) — ID: {r.id}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                    )}

                    {/* Multiple Candidates Selector */}
                    {robberFoundCandidates.length > 0 && (
                      <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl space-y-2">
                        <p className="text-[10px] uppercase font-bold text-red-400">
                          Multiple matching users found. Click one to steal:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {robberFoundCandidates.map((cand) => (
                            <button
                              key={cand.id}
                              onClick={() => {
                                setRobberTargetId(cand.id);
                                handleRobber(cand.id, cand.guildId);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-red-700/30 border border-white/10 hover:border-red-500/40 text-xs text-white flex items-center gap-2 transition-all"
                            >
                              <span className="font-bold">{cand.global_name || cand.username}</span>
                              <span className="text-[10px] text-white/40 font-mono">(@{cand.username})</span>
                              <span className="text-[9px] text-red-400 font-mono">ID: {cand.id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Banner */}
                  {robberStatus && (
                    <div className={`p-3 rounded-xl border text-xs font-mono text-center transition-all ${
                      robberStatus.startsWith('Error') 
                        ? 'bg-red-950/30 border-red-500/30 text-red-400' 
                        : robberStatus.includes('success') || robberStatus.includes('stolen')
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/10 text-white/70'
                    }`}>
                      {robberStatus}
                    </div>
                  )}

                  {/* Stolen Asset Results Showcase */}
                  {robberResult && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {robberResult.type === 'user' && (
                        <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden glass-card">
                          {/* Profile Banner Header */}
                          <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-black/80 flex items-center justify-center">
                            {robberResult.banner ? (
                              <img 
                                src={robberResult.banner} 
                                alt="User Banner"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : robberResult.accentColor ? (
                              <div 
                                className="w-full h-full flex flex-col items-center justify-center relative"
                                style={{
                                  backgroundColor: robberResult.accentColor,
                                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.3) 100%)'
                                }}
                              >
                                <span className="px-3 py-1 rounded-full bg-black/50 text-[10px] font-mono text-white/90 uppercase tracking-widest font-bold backdrop-blur-sm border border-white/10">
                                  Profile Color Banner: {robberResult.accentColor}
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs uppercase tracking-widest font-mono text-white/20">
                                No Custom Banner
                              </div>
                            )}

                            {/* Banner Action Badges */}
                            {robberResult.banner && (
                              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-bold text-red-400 border border-red-500/30 uppercase tracking-wider">
                                  {robberResult.isAnimatedBanner ? 'GIF 4K' : 'PNG 4K'}
                                </span>
                                <a 
                                  href={robberResult.banner} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="px-2.5 py-1 rounded-md bg-black/70 hover:bg-red-600 text-white backdrop-blur-md text-[10px] font-bold border border-white/20 transition-all flex items-center gap-1"
                                >
                                  <ExternalLink size={11} />
                                  <span>4K View</span>
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Profile Body with Avatar Overlap */}
                          <div className="px-6 pb-6 pt-3 space-y-5">
                            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
                              <div className="flex items-end gap-4">
                                <div className="relative group">
                                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-black bg-black shadow-2xl relative">
                                    <img 
                                      src={robberResult.avatar} 
                                      alt={robberResult.username}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-bold uppercase tracking-wider text-red-400 border border-red-500/40">
                                      {robberResult.isAnimatedAvatar ? 'GIF 4K' : '4K'}
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1 mb-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                                      {robberResult.globalName || robberResult.username}
                                    </h3>
                                    {robberResult.nickname && (
                                      <span className="text-xs text-white/50 font-normal">
                                        (Server Nick: {robberResult.nickname})
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-white/50 font-mono">
                                    @{robberResult.username}
                                  </p>
                                </div>
                              </div>

                              {/* Action Badges & ID Copy */}
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(robberResult.id, 'id')}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-mono text-white/80 hover:text-white transition-all flex items-center gap-1.5"
                                  title="Copy Discord Snowflake ID"
                                >
                                  {copiedText === 'id' ? (
                                    <>
                                      <Check size={12} className="text-emerald-400" />
                                      <span className="text-emerald-400 font-bold">Copied ID!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} className="text-red-400" />
                                      <span>ID: {robberResult.id}</span>
                                    </>
                                  )}
                                </button>
                                {robberResult.createdAt && (
                                  <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-white/50">
                                    Created: {robberResult.createdAt}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* User Bio if present */}
                            {robberResult.bio && (
                              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                                <span className="text-[9px] uppercase font-bold text-white/40 tracking-wider">About Me</span>
                                <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed font-sans">
                                  {robberResult.bio}
                                </p>
                              </div>
                            )}

                            {/* Asset Quality Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              {/* Avatar Download Card */}
                              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/60">
                                    Profile Picture (4K UHD)
                                  </span>
                                  <span className="text-[9px] font-mono text-red-400">4096 × 4096</span>
                                </div>
                                <div className="aspect-square max-h-56 mx-auto rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                                  <img 
                                    src={robberResult.avatar} 
                                    alt="4K Avatar"
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => copyToClipboard(robberResult.avatar, 'avatar')}
                                    className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1.5"
                                  >
                                    {copiedText === 'avatar' ? (
                                      <>
                                        <Check size={12} className="text-emerald-400" />
                                        <span className="text-emerald-400">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={12} />
                                        <span>Copy Link</span>
                                      </>
                                    )}
                                  </button>
                                  <a 
                                    href={robberResult.avatar} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex-1 py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5"
                                  >
                                    <ExternalLink size={12} />
                                    <span>Open 4K</span>
                                  </a>
                                </div>
                              </div>

                              {/* Banner Download Card */}
                              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 flex flex-col justify-between">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/60">
                                      Profile Banner (4K UHD)
                                    </span>
                                    {robberResult.banner && (
                                      <span className="text-[9px] font-mono text-red-400">4096 px</span>
                                    )}
                                  </div>
                                  <div className="aspect-video max-h-56 mx-auto w-full rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                                    {robberResult.banner ? (
                                      <img 
                                        src={robberResult.banner} 
                                        alt="4K Banner"
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : robberResult.accentColor ? (
                                      <div 
                                        className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
                                        style={{ backgroundColor: robberResult.accentColor }}
                                      >
                                        <span className="px-2.5 py-1 rounded bg-black/60 text-[11px] font-bold text-white font-mono">
                                          Accent: {robberResult.accentColor}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-white/30 uppercase font-bold">
                                        No Banner Set
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {robberResult.banner ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => copyToClipboard(robberResult.banner, 'banner')}
                                      className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1.5"
                                    >
                                      {copiedText === 'banner' ? (
                                        <>
                                          <Check size={12} className="text-emerald-400" />
                                          <span className="text-emerald-400">Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Link</span>
                                        </>
                                      )}
                                    </button>
                                    <a 
                                      href={robberResult.banner} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="flex-1 py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5"
                                    >
                                      <ExternalLink size={12} />
                                      <span>Open 4K</span>
                                    </a>
                                  </div>
                                ) : robberResult.accentColor ? (
                                  <button
                                    onClick={() => copyToClipboard(robberResult.accentColor, 'color')}
                                    className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1.5"
                                  >
                                    {copiedText === 'color' ? (
                                      <>
                                        <Check size={12} className="text-emerald-400" />
                                        <span className="text-emerald-400">Copied Hex Code!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={12} />
                                        <span>Copy Color: {robberResult.accentColor}</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <div className="text-center text-[10px] text-white/30 italic py-2">
                                    Default Discord profile background
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Guild Assets Result */}
                      {robberResult.type === 'guild' && (
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 glass-card space-y-6">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div>
                              <h3 className="text-lg font-bold text-white">{robberResult.name}</h3>
                              <p className="text-xs text-white/40 font-mono">Guild ID: {robberResult.id}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(robberResult.id, 'guildId')}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 flex items-center gap-1.5"
                            >
                              <Copy size={12} />
                              <span>Copy Guild ID</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <span className="text-[10px] uppercase font-bold text-white/50">Server Icon (4K)</span>
                              <div className="aspect-square bg-black/60 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center">
                                {robberResult.icon ? (
                                  <img src={robberResult.icon} alt="Guild Icon" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs text-white/20">No Icon</span>
                                )}
                              </div>
                              {robberResult.icon && (
                                <a href={robberResult.icon} target="_blank" rel="noreferrer" className="block text-center text-xs text-red-400 hover:underline">
                                  Open 4K Icon
                                </a>
                              )}
                            </div>

                            <div className="space-y-2">
                              <span className="text-[10px] uppercase font-bold text-white/50">Server Banner (4K)</span>
                              <div className="aspect-video bg-black/60 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center">
                                {robberResult.banner ? (
                                  <img src={robberResult.banner} alt="Guild Banner" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs text-white/20">No Banner</span>
                                )}
                              </div>
                              {robberResult.banner && (
                                <a href={robberResult.banner} target="_blank" rel="noreferrer" className="block text-center text-xs text-red-400 hover:underline">
                                  Open 4K Banner
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'gc-changer' && (
                <div className="space-y-6">
                  <div className="border-b border-white/5 pb-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold italic font-display text-red-500">GC Name Changer</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setGcLoop(!gcLoop)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${gcLoop ? 'bg-red-700 border-red-500 text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                      >
                        LOOP
                      </button>
                      <button 
                        onClick={() => setGcCountdown(!gcCountdown)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${gcCountdown ? 'bg-red-700 border-red-500 text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                      >
                        COUNTDOWN
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40">Group Chat ID</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={gcId}
                          onChange={(e) => setGcId(e.target.value)}
                          placeholder="Enter GC ID..."
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                        />
                        <button 
                          onClick={() => setActiveTab('channels')}
                          className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-500 transition-all"
                          title="Select from list"
                        >
                          <Hash size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {!gcCountdown && (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">
                          {gcLoop ? 'GC Names (comma separated)' : 'New GC Name'}
                        </label>
                        <input 
                          type="text"
                          value={gcNewName}
                          onChange={(e) => setGcNewName(e.target.value)}
                          placeholder={gcLoop ? "name1, name2, name3..." : "Enter New Name..."}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                    )}

                    {gcCountdown && (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Countdown Start</label>
                        <input 
                          type="number"
                          value={gcCountdownStart}
                          onChange={(e) => setGcCountdownStart(parseInt(e.target.value))}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40">Delay (seconds)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={gcDelay}
                        onChange={(e) => setGcDelay(parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                      />
                    </div>

                    <button 
                      onClick={gcLoop || gcCountdown ? () => {} : changeGcName}
                      className={`w-full font-bold py-3 rounded-xl shadow-lg transition-all ${
                        (gcLoop || gcCountdown) ? 'bg-red-700/20 border border-red-500 text-red-500' : 'bg-red-700 hover:bg-red-600 text-white shadow-red-600/20'
                      }`}
                    >
                      {gcLoop || gcCountdown ? 'Running...' : 'Update Name'}
                    </button>
                    {gcStatus && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-xs text-red-400 font-mono">
                        {gcStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'wl-gen' && (
                <div className="space-y-6">
                  <div className="border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">Whitelist Generator</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40">Amount to Generate</label>
                      <input 
                        type="number"
                        value={wlAmount}
                        onChange={(e) => setWlAmount(parseInt(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                      />
                    </div>
                    <button 
                      onClick={generatePhrases}
                      className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20 transition-all"
                    >
                      Generate Phrases
                    </button>
                    <textarea 
                      value={wlOutput}
                      readOnly
                      placeholder="Generated phrases will appear here..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-red-500/50 min-h-[200px] resize-none font-mono"
                    />
                    {wlStatus && (
                      <div className="text-center text-xs text-white/40">{wlStatus}</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'autobeefer' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">AutoBeefer</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAutobeeferCase(prev => prev === 'upper' ? 'none' : 'upper')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${autobeeferCase === 'upper' ? 'bg-red-700 border-red-500 text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                      >
                        UPPER
                      </button>
                      <button 
                        onClick={() => setAutobeeferCase(prev => prev === 'lower' ? 'none' : 'lower')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold border transition-all ${autobeeferCase === 'lower' ? 'bg-red-700 border-red-500 text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                      >
                        lower
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40">Target Channel ID</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={channelId}
                          onChange={(e) => setChannelId(e.target.value)}
                          placeholder="Enter Channel ID..."
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                        />
                        <button 
                          onClick={() => setActiveTab('channels')}
                          className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-500 transition-all"
                          title="Select from list"
                        >
                          <Hash size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-black/40 border border-dashed border-white/20 rounded-2xl p-8 text-center space-y-4">
                      <FileText size={32} className="mx-auto text-white/20" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Upload Word List</p>
                        <p className="text-xs text-white/30">Select a .txt file with one phrase per line</p>
                      </div>
                      <input 
                        type="file" 
                        accept=".txt" 
                        onChange={(e) => handleFileUpload(e, 'auto')}
                        className="hidden" 
                        id="auto-file" 
                      />
                      <label 
                        htmlFor="auto-file"
                        className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-full text-xs font-bold cursor-pointer transition-all"
                      >
                        Browse Files
                      </label>
                      {autobeeferMessages.length > 0 && (
                        <p className="text-xs text-red-400 font-bold">Loaded {autobeeferMessages.length} phrases</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <label className="text-[10px] uppercase font-bold text-white/40">Delay (Seconds)</label>
                            <span className="text-[10px] font-bold text-red-400">{delay}s</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.1" 
                            max="5" 
                            step="0.1" 
                            value={delay}
                            onChange={(e) => setDelay(parseFloat(e.target.value))}
                            className="w-full accent-red-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <button 
                            onClick={() => setAutoBold(!autoBold)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${autoBold ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                          >
                            <span className="text-sm font-medium">Auto Bold</span>
                            <div className={`w-4 h-4 rounded-full border-2 ${autoBold ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                          </button>
                          {autoBold && (
                            <input 
                              type="number" 
                              value={boldChance}
                              onChange={(e) => setBoldChance(parseInt(e.target.value))}
                              placeholder="Chance %"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-1.5 text-xs"
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <button 
                            onClick={() => setLadderMode(!ladderMode)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${ladderMode ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                          >
                            <span className="text-sm font-medium">Ladder Mode</span>
                            <div className={`w-4 h-4 rounded-full border-2 ${ladderMode ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                          </button>
                          {ladderMode && (
                            <input 
                              type="number" 
                              value={ladderChance}
                              onChange={(e) => setLadderChance(parseInt(e.target.value))}
                              placeholder="Chance %"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-1.5 text-xs"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <button 
                        onClick={() => setAutobeeferActive(true)}
                        disabled={autobeeferActive || autobeeferMessages.length === 0}
                        className="bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Play size={18} /> Start
                      </button>
                      <button 
                        onClick={() => setAutobeeferActive(false)}
                        disabled={!autobeeferActive}
                        className="bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Square size={18} /> Stop
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'legit' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">Legit Beefer</h2>
                    <button 
                      onClick={() => setLegitEnabled(!legitEnabled)}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${legitEnabled ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                    >
                      {legitEnabled ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-black/40 border border-dashed border-white/20 rounded-2xl p-8 text-center space-y-4">
                      <FileText size={32} className="mx-auto text-white/20" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Upload Word List</p>
                        <p className="text-xs text-white/30">Select a .txt file for manual triggers</p>
                      </div>
                      <input 
                        type="file" 
                        accept=".txt" 
                        onChange={(e) => handleFileUpload(e, 'legit')}
                        className="hidden" 
                        id="legit-file" 
                      />
                      <label 
                        htmlFor="legit-file"
                        className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-full text-xs font-bold cursor-pointer transition-all"
                      >
                        Browse Files
                      </label>
                      {legitMessages.length > 0 && (
                        <p className="text-xs text-red-400 font-bold">Loaded {legitMessages.length} phrases</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-white/40">Trigger Key</label>
                          <select 
                            value={triggerKey}
                            onChange={(e) => setTriggerKey(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                          >
                            <option value="Delete">Delete Key</option>
                            <option value="F1">F1</option>
                            <option value="F2">F2</option>
                            <option value="F3">F3</option>
                            <option value="Insert">Insert</option>
                            <option value="End">End</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-white/40">Messages Per Second</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={mps}
                            onChange={(e) => setMps(parseFloat(e.target.value))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-white/40">Case Settings</label>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setLegitCase(prev => prev === 'upper' ? 'none' : 'upper')}
                              className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${legitCase === 'upper' ? 'bg-red-700 border-red-500 text-white' : 'bg-black/40 border-white/10 text-white/40'}`}
                            >
                              UPPER
                            </button>
                            <button 
                              onClick={() => setLegitCase(prev => prev === 'lower' ? 'none' : 'lower')}
                              className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${legitCase === 'lower' ? 'bg-red-700 border-red-500 text-white' : 'bg-black/40 border-white/10 text-white/40'}`}
                            >
                              lower
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <button 
                            onClick={() => setRandomizeLegit(!randomizeLegit)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${randomizeLegit ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                          >
                            <span className="text-sm font-medium">Randomize Order</span>
                            <div className={`w-4 h-4 rounded-full border-2 ${randomizeLegit ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-red-700/10 border border-red-500/30 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-red-400">
                        <Terminal size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Next Message Preview</span>
                      </div>
                      <p className="text-sm font-mono text-white/80">
                        {syncLists 
                          ? (autobeeferMessages[currentLegitIndex % autobeeferMessages.length] || 'No messages loaded')
                          : (legitMessages[currentLegitIndex % legitMessages.length] || 'No messages loaded')
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

                  {activeTab === 'auto-reply' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">Auto Reply</h2>
                    <button 
                      onClick={() => setAutoReplyActive(!autoReplyActive)}
                      className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${autoReplyActive ? 'bg-red-700 text-white shadow-red-600/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/10'}`}
                    >
                      {autoReplyActive ? 'STOP REPLY' : 'START REPLY'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Target Channel ID</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={channelId}
                            onChange={(e) => setChannelId(e.target.value)}
                            placeholder="Enter Channel ID..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                          />
                          <button 
                            onClick={() => setActiveTab('channels')}
                            className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-500 transition-all"
                            title="Select from list"
                          >
                            <Hash size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Custom Name in Reply</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={autoReplyCustomName}
                            onChange={(e) => setAutoReplyCustomName(e.target.value)}
                            placeholder="e.g. name..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                          />
                          <button 
                            onClick={() => setAutoReplyIntroEnabled(!autoReplyIntroEnabled)}
                            className={`px-3 rounded-xl border transition-all text-[10px] font-bold ${autoReplyIntroEnabled ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                          >
                            INTRO
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Text Case</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['none', 'upper', 'lower', 'ladder'] as const).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setAutoReplyCase(mode)}
                              className={`py-2 rounded-xl border text-[10px] font-bold uppercase transition-all ${autoReplyCase === mode ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40 hover:text-white'}`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Custom Messages (comma separated)</label>
                        <input 
                          type="text"
                          value={autoReplyCustomMessages}
                          onChange={(e) => setAutoReplyCustomMessages(e.target.value)}
                          placeholder="msg1, msg2, msg3..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] uppercase font-bold text-white/40">Reply Delay (Seconds)</label>
                          <span className="text-[10px] font-mono text-red-500">{autoReplyDelay}s</span>
                        </div>
                        <input 
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={autoReplyDelay}
                          onChange={(e) => setAutoReplyDelay(parseFloat(e.target.value))}
                          className="w-full accent-red-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-black/40 border border-dashed border-white/20 rounded-2xl p-6 text-center space-y-4">
                        <Upload size={24} className="mx-auto text-white/20" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Upload Reply List</p>
                          <p className="text-xs text-white/30">Select a .txt file for custom replies</p>
                        </div>
                        <input 
                          type="file" 
                          accept=".txt" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const text = ev.target?.result as string;
                                setAutoReplyMessages(text.split('\n').filter(l => l.trim()));
                              };
                              reader.readAsText(file);
                            }
                          }}
                          className="hidden" 
                          id="reply-file" 
                        />
                        <label 
                          htmlFor="reply-file"
                          className="inline-block bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-full text-xs font-bold cursor-pointer transition-all"
                        >
                          Browse Files
                        </label>
                        {autoReplyMessages.length > 0 && (
                          <p className="text-xs text-red-400 font-bold">Loaded {autoReplyMessages.length} replies</p>
                        )}
                      </div>
                      <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                        <p className="text-[10px] text-red-500/60 leading-relaxed">
                          Auto Reply will target the <strong>User ID</strong> specified in the global inputs. 
                          Typing indicator starts instantly when the target user sends a message.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'anti-afk' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">Anti AFK</h2>
                    <button 
                      onClick={() => {
                        if (!antiAfkActive) {
                          antiAfkReplyIndexRef.current = 0;
                        }
                        setAntiAfkActive(!antiAfkActive);
                      }}
                      className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${antiAfkActive ? 'bg-red-700 text-white shadow-red-600/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/10'}`}
                    >
                      {antiAfkActive ? 'STOP MONITOR' : 'START MONITOR'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Guild ID (Optional - Server Wide)</label>
                        <input 
                          type="text"
                          value={antiAfkGuildId}
                          onChange={(e) => setAntiAfkGuildId(e.target.value)}
                          placeholder="Enter Guild ID for server-wide..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] uppercase font-bold text-white/40">Reply Delay (Seconds)</label>
                          <span className="text-[10px] font-mono text-red-500">{antiAfkDelay}s</span>
                        </div>
                        <input 
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={antiAfkDelay}
                          onChange={(e) => setAntiAfkDelay(parseFloat(e.target.value))}
                          className="w-full accent-red-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <button 
                          onClick={() => setAntiAfkUseDefault(!antiAfkUseDefault)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${!antiAfkUseDefault ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                        >
                          <span className="text-sm font-medium">Use Custom Replies Only</span>
                          <div className={`w-4 h-4 rounded-full border-2 ${!antiAfkUseDefault ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Custom Replies (comma separated)</label>
                        <textarea 
                          value={antiAfkCustomMessages}
                          onChange={(e) => setAntiAfkCustomMessages(e.target.value)}
                          placeholder="im here, still here, manual btw..."
                          className="w-full h-32 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <p className="text-[10px] text-red-500/60 leading-relaxed">
                      Each AFK check gets one reply from your list in order — check #1 → reply #1, check #2 → reply #2. It never sends all replies at once.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'afk-check' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold italic font-display text-red-500">AFK Check</h2>
                    <button 
                      onClick={() => setAfkCheckActive(!afkCheckActive)}
                      className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${afkCheckActive ? 'bg-red-700 text-white shadow-red-600/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/10'}`}
                    >
                      {afkCheckActive ? 'STOP CHECK' : 'START CHECK'}
                    </button>
                  </div>

                  <div className="max-w-md mx-auto space-y-6 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 text-center">
                        <label className="text-[10px] uppercase font-bold text-white/40">Countdown Start</label>
                        <input 
                          type="number"
                          value={afkCheckValue}
                          onChange={(e) => setAfkCheckValue(parseInt(e.target.value) || 0)}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-3xl font-bold text-center focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                      <div className="space-y-2 text-center">
                        <label className="text-[10px] uppercase font-bold text-white/40">Delay (s)</label>
                        <input 
                          type="number"
                          step="0.1"
                          value={afkCheckDelay}
                          onChange={(e) => setAfkCheckDelay(parseFloat(e.target.value) || 0.1)}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-3xl font-bold text-center focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                    </div>

                    {afkCheckActive && (
                      <div className="text-center space-y-2">
                        <div className="text-6xl font-black text-red-500 animate-pulse">{afkCheckCurrent}</div>
                        <div className="text-[10px] uppercase tracking-widest text-white/20">Counting Down...</div>
                      </div>
                    )}

                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-center">
                      <p className="text-[10px] text-red-500/60 leading-relaxed">
                        Counts down from your chosen number to 0. 
                        Sends a message every 1 second with a typing indicator.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'delete-messages' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-bold italic font-display text-red-500">Delete Messages</h2>
                      <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5">
                        <div className="text-right">
                          <p className="text-[8px] uppercase font-bold text-white/40">Auto Refresh</p>
                          <p className="text-[10px] font-mono text-red-500">{autoRefreshDeleteInterval}s</p>
                        </div>
                        <button 
                          onClick={() => setAutoRefreshDelete(!autoRefreshDelete)}
                          className={`w-8 h-4 rounded-full transition-colors relative ${autoRefreshDelete ? 'bg-red-600' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoRefreshDelete ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleDeleteMessages}
                        disabled={isDeleting}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${isDeleting ? 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600 text-white shadow-red-600/20'}`}
                      >
                        START DELETION
                      </button>
                      <button 
                        onClick={() => { deletionStoppedRef.current = true; setIsDeleting(false); }}
                        disabled={!isDeleting}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${!isDeleting ? 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600 text-white shadow-red-600/20'}`}
                      >
                        STOP
                      </button>
                      <button 
                        onClick={() => { setDeleteLog([]); setDeleteStatus(''); setSelectedTarget(null); setDeleteStartLink(''); setDeleteEndLink(''); }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl font-bold text-sm transition-all border border-white/10"
                      >
                        CLEAR
                      </button>
                    </div>
                  </div>

                  {autoRefreshDelete && (
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase font-bold text-white/40">Auto Refresh Interval</label>
                        <span className="text-[10px] font-mono text-red-500">{autoRefreshDeleteInterval}s</span>
                      </div>
                      <input 
                        type="range"
                        min="10"
                        max="300"
                        step="10"
                        value={autoRefreshDeleteInterval}
                        onChange={(e) => setAutoRefreshDeleteInterval(parseInt(e.target.value))}
                        className="w-full accent-red-500"
                      />
                    </div>
                  )}

                  {selectedTarget && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                      <Trash2 size={18} className="text-red-500" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-red-500/60">Active Target</p>
                        <p className="text-sm font-bold text-white">
                          {selectedTarget.type === 'channel' ? 'Server Channel' : 'DM'} → {selectedTarget.name}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedTarget(null)}
                        className="ml-auto text-[10px] uppercase font-bold text-white/40 hover:text-white"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {!selectedTarget && deleteMode !== 'link' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-white/40">
                            <User size={12} /> Direct Messages
                          </div>
                          <button 
                            onClick={refreshDms}
                            disabled={isRefreshingDms}
                            title="Refresh DMs"
                            className={`p-1 rounded-md transition-all ${isRefreshingDms ? 'animate-spin text-red-500' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                        <div className="relative">
                          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                          <input 
                            type="text"
                            value={dmSearch}
                            onChange={(e) => setDmSearch(e.target.value)}
                            placeholder="Search by name or ID..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-[10px] focus:outline-none focus:border-red-500/50"
                          />
                          {dmSearch && (
                            <button 
                              onClick={() => setDmSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                            >
                              <RotateCcw size={10} />
                            </button>
                          )}
                        </div>
                        <div className={`bg-black/40 border border-white/10 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar transition-opacity ${isRefreshingDms ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                          {dms.length === 0 ? (
                            <div className="p-8 text-center text-white/20 text-xs">{isRefreshingDms ? 'Refreshing DMs...' : 'No DMs found. Connect token first.'}</div>
                          ) : (
                            dms.filter(dm => {
                              const search = dmSearch.toLowerCase();
                              const username = (dm.recipients?.[0]?.username || '').toLowerCase();
                              return username.includes(search) || dm.id.includes(search);
                            }).map(dm => (
                              <button
                                key={dm.id}
                                onClick={() => {
                                  setChannelId(dm.id);
                                  setGcId(dm.id);
                                  setSelectedTarget({ id: dm.id, name: dm.recipients?.[0]?.username || 'Group DM', type: 'dm' });
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left"
                              >
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                  {dm.recipients?.[0]?.avatar ? (
                                    <img src={`https://cdn.discordapp.com/avatars/${dm.recipients[0].id}/${dm.recipients[0].avatar}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <User size={16} className="text-white/40" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{dm.recipients?.[0]?.username || 'Group DM'}</p>
                                  <p className="text-[10px] text-white/40 truncate">{getRelativeTime(dm.last_message_id)}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-white/40">
                            <Server size={12} /> Servers
                          </div>
                          <button 
                            onClick={refreshGuilds}
                            disabled={isRefreshingGuilds}
                            title="Refresh Servers"
                            className={`p-1 rounded-md transition-all ${isRefreshingGuilds ? 'animate-spin text-red-500' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                        <div className="relative">
                          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                          <input 
                            type="text"
                            value={guildSearch}
                            onChange={(e) => setGuildSearch(e.target.value)}
                            placeholder="Search by name or ID..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-[10px] focus:outline-none focus:border-red-500/50"
                          />
                          {guildSearch && (
                            <button 
                              onClick={() => setGuildSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                            >
                              <RotateCcw size={10} />
                            </button>
                          )}
                        </div>
                        <div className={`bg-black/40 border border-white/10 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar transition-opacity ${isRefreshingGuilds ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                          {guilds.length === 0 ? (
                            <div className="p-8 text-center text-white/20 text-xs">{isRefreshingGuilds ? 'Refreshing Servers...' : 'No servers found. Connect token first.'}</div>
                          ) : (
                            guilds.filter(guild => {
                              const search = guildSearch.toLowerCase();
                              return guild.name.toLowerCase().includes(search) || guild.id.includes(search);
                            }).map(guild => (
                              <div key={guild.id} className="border-b border-white/5 last:border-0">
                                <button
                                  onClick={() => {
                                    if (selectedGuildId === guild.id) {
                                      setSelectedGuildId(null);
                                    } else {
                                      setSelectedGuildId(guild.id);
                                      fetchGuildChannels(guild.id);
                                    }
                                  }}
                                  className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                                    {guild.icon ? (
                                      <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="text-[10px] font-bold text-white/40">{guild.name.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{guild.name}</p>
                                  </div>
                                  <ChevronRight size={14} className={`text-white/20 transition-transform ${selectedGuildId === guild.id ? 'rotate-90' : ''}`} />
                                </button>
                                {selectedGuildId === guild.id && (
                                  <div className="bg-black/20 py-2 px-4 space-y-1">
                                    {selectedGuildChannels.length === 0 ? (
                                      <p className="text-[10px] text-white/20 p-2">Loading channels...</p>
                                    ) : (
                                      selectedGuildChannels.map(channel => (
                                        <button
                                          key={channel.id}
                                          onClick={() => {
                                            setChannelId(channel.id);
                                            setSelectedTarget({ id: channel.id, name: `#${channel.name}`, type: 'channel' });
                                          }}
                                          className="w-full flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-left text-[11px] text-white/60 hover:text-white transition-colors"
                                        >
                                          <Hash size={12} className="text-white/20" />
                                          <span className="truncate">{channel.name}</span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                        {(['count', 'link', 'date', 'all', 'keyword', 'range'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setDeleteMode(mode)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${deleteMode === mode ? 'bg-red-700 text-white' : 'text-white/40 hover:text-white'}`}
                          >
                            By {mode === 'all' ? 'All' : mode}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4">
                        {deleteMode === 'all' && (
                          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 space-y-2">
                            <p className="text-xs text-white font-bold">All Messages Mode</p>
                            <p className="text-[10px] text-white/60 leading-relaxed">
                              This will search for and delete ALL of your messages in the selected channel or DM. 
                              It uses the Discord Search API to find every message you've ever sent.
                            </p>
                          </div>
                        )}
                        {deleteMode === 'count' && (
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/40">Number of Messages</label>
                            <input 
                              type="number"
                              value={deleteCount}
                              onChange={(e) => setDeleteCount(parseInt(e.target.value))}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                        )}

                        {deleteMode === 'link' && (
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><Link size={10} /> Message Link</label>
                            <input 
                              type="text"
                              value={deleteStartLink}
                              onChange={(e) => setDeleteStartLink(e.target.value)}
                              placeholder="https://discord.com/channels/..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                        )}

                        {deleteMode === 'range' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><Link size={10} /> Start Message Link</label>
                              <input 
                                type="text"
                                value={deleteStartLink}
                                onChange={(e) => setDeleteStartLink(e.target.value)}
                                placeholder="https://discord.com/channels/..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><Link size={10} /> End Message Link</label>
                              <input 
                                type="text"
                                value={deleteEndLink}
                                onChange={(e) => setDeleteEndLink(e.target.value)}
                                placeholder="https://discord.com/channels/..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                              />
                            </div>
                          </div>
                        )}

                        {deleteMode === 'date' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><Calendar size={10} /> From Date</label>
                              <input 
                                type="datetime-local"
                                value={deleteStartDate}
                                onChange={(e) => setDeleteStartDate(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><Calendar size={10} /> To Date</label>
                              <input 
                                type="datetime-local"
                                value={deleteEndDate}
                                onChange={(e) => setDeleteEndDate(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 text-white"
                              />
                            </div>
                          </div>
                        )}

                        {deleteMode === 'keyword' && (
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><Search size={10} /> Keyword Filter</label>
                            <input 
                              type="text"
                              value={deleteKeyword}
                              onChange={(e) => setDeleteKeyword(e.target.value)}
                              placeholder="Enter keyword to search for..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                          <div className="space-y-0.5">
                            <label className="text-[10px] uppercase font-bold text-white/60">Dry Run Mode</label>
                            <p className="text-[8px] text-white/20">Scan and log messages without deleting them</p>
                          </div>
                          <button 
                            onClick={() => setIsDryRun(!isDryRun)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${isDryRun ? 'bg-amber-600' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isDryRun ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                          <div className="space-y-0.5">
                            <label className="text-[10px] uppercase font-bold text-white/60">Include Pinned</label>
                            <p className="text-[8px] text-white/20">Delete messages even if they are pinned</p>
                          </div>
                          <button 
                            onClick={() => setDeleteIncludePinned(!deleteIncludePinned)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${deleteIncludePinned ? 'bg-red-600' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${deleteIncludePinned ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <label className="text-[10px] uppercase font-bold text-white/40">Deletion Delay (Seconds)</label>
                            <span className="text-[10px] font-mono text-red-500">{deleteDelay}s</span>
                          </div>
                          <input 
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.1"
                            value={deleteDelay}
                            onChange={(e) => setDeleteDelay(parseFloat(e.target.value))}
                            className="w-full accent-red-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-2"><User size={10} /> Target User ID (Optional)</label>
                            <input 
                              type="text"
                              value={deleteTargetUserId}
                              onChange={(e) => setDeleteTargetUserId(e.target.value)}
                              placeholder="Leave empty for yourself..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                            <div className="space-y-0.5">
                              <label className="text-[10px] uppercase font-bold text-white/60">Only Attachments</label>
                              <p className="text-[8px] text-white/20">Delete only messages with files/images</p>
                            </div>
                            <button 
                              onClick={() => setDeleteOnlyAttachments(!deleteOnlyAttachments)}
                              className={`w-10 h-5 rounded-full transition-colors relative ${deleteOnlyAttachments ? 'bg-red-600' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${deleteOnlyAttachments ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/40 px-2">Live Progress Log</label>
                    <div className="bg-black/80 border border-white/5 rounded-2xl p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar">
                      {deleteLog.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-white/10 italic">Waiting for action...</div>
                      ) : (
                        deleteLog.map(log => (
                          <div key={log.id} className={`flex gap-2 ${
                            log.type === 'success' ? 'text-emerald-400' : 
                            log.type === 'warn' ? 'text-amber-400' : 
                            log.type === 'error' ? 'text-red-400' : 
                            log.type === 'done' ? 'text-blue-400 font-bold' : 
                            'text-white/60'
                          }`}>
                            <span className="opacity-40">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                            <span>{log.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'options' && (
                    <div className="space-y-6">
                      <div className="border-b border-white/5 pb-4">
                        <h2 className="text-xl font-bold italic font-display text-red-500">Options</h2>
                      </div>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <button 
                              onClick={() => setAutoReact(!autoReact)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${autoReact ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                            >
                              <span className="text-sm font-medium">Auto Reaction</span>
                              <div className={`w-4 h-4 rounded-full border-2 ${autoReact ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                            </button>
                            {autoReact && (
                              <input 
                                type="text" 
                                value={reactionEmoji}
                                onChange={(e) => setReactionEmoji(e.target.value)}
                                placeholder="Emoji..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                              />
                            )}
                            <button 
                              onClick={() => setMentionTarget(!mentionTarget)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${mentionTarget ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                            >
                              <span className="text-sm font-medium">Mention Target</span>
                              <div className={`w-4 h-4 rounded-full border-2 ${mentionTarget ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                            </button>
                            <button 
                              onClick={() => setSyncLists(!syncLists)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${syncLists ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                            >
                              <span className="text-sm font-medium">Sync Word Lists</span>
                              <div className={`w-4 h-4 rounded-full border-2 ${syncLists ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <button 
                              onClick={() => setTypingIndicator(!typingIndicator)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${typingIndicator ? 'bg-red-700/20 border-red-500 text-red-400' : 'bg-black/40 border-white/10 text-white/40'}`}
                            >
                              <span className="text-sm font-medium">Typing Indicator</span>
                              <div className={`w-4 h-4 rounded-full border-2 ${typingIndicator ? 'bg-red-500 border-red-400' : 'border-white/20'}`} />
                            </button>
                            
                            <div className="space-y-2">
                              <button 
                                onClick={() => {
                                  setAutobeeferMessages([]);
                                  setLegitMessages([]);
                                  setSkippedIndices(new Set());
                                  alert('All lists cleared');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all text-sm font-medium"
                              >
                                <Trash2 size={16} /> Clear All Lists
                              </button>
                              <button 
                                onClick={() => {
                                  setSkippedIndices(new Set());
                                  setCurrentLegitIndex(0);
                                  antiAfkReplyIndexRef.current = 0;
                                  alert('Reset complete');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all text-sm font-medium"
                              >
                                <RefreshCw size={16} /> Reset Progress
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'about-me' && (
                    <div className="space-y-8 flex flex-col items-center">
                      {/* FIX 1: ONE profile card only */}
                      <div className="w-full max-w-md bg-[#111214] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                        {/* Banner — FIX 2: fallback is bg-black */}
                        <div className="h-24 w-full relative">
                          {aboutMeProfile?.user?.banner ? (
                            <img 
                              src={`https://cdn.discordapp.com/banners/1288332302543360026/${aboutMeProfile.user.banner}.png?size=480`} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-black" />
                          )}
                          
                          {/* Avatar */}
                          <div className="absolute -bottom-8 left-4">
                            <div className="relative">
                              <div className="w-20 h-20 rounded-full border-[6px] border-[#111214] bg-[#111214] overflow-hidden">
                                {aboutMeProfile?.user?.avatar ? (
                                  <img 
                                    src={`https://cdn.discordapp.com/avatars/1288332302543360026/${aboutMeProfile.user.avatar}.png?size=256`} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-red-700 flex items-center justify-center">
                                    <User size={32} className="text-white/40" />
                                  </div>
                                )}
                              </div>
                              {/* Status Dot — FIX 3: fallback is bg-black border-black */}
                              <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-[4px] border-[#111214]">
                                <img
                                  src="https://cdn.discordapp.com/attachments/1297029464387096607/1477850041887756379/7389_streaming.png?ex=69a6429b&is=69a4f11b&hm=8e4d767fac605f1758c016ab311dfbc6788fcac0e0e9be07158a564dce2e0eac&"
                                  className="w-full h-full rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Profile Info */}
                        <div className="pt-10 pb-6 px-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              {/* FIX 5: display name hardcoded to ٴٴ, handle hardcoded to @puxds */}
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                ٴٴ
                                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-bold rounded uppercase tracking-tighter border border-red-500/20">
                                  SLENDO
                                </span>
                              </h3>
                              <p className="text-[10px] text-white/40 font-mono">@puxds</p>
                            </div>
                          </div>

                          {/* About Me Section — FIX 4: bio hardcoded */}
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/60">About Me</h4>
                            <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                              <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                                𖤐 | gg/slendo
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* FIX 1: ONE message section only */}
                      <div className="w-full max-w-md bg-black/60 rounded-2xl border border-red-500/20 p-6 backdrop-blur-sm glass-card space-y-4 font-mono">
                        <div className="space-y-1">
                          <p className="text-sm text-white">THIS CORD WAS MADE BY ME <span className="text-red-500 font-bold">SLENDO</span></p>
                          <p className="text-xs text-white/60 italic">Probably the best cord you've ever used in your life — enjoy it.</p>
                        </div>
                        
                        <div className="h-px bg-red-500/10" />
                        
                        <div className="space-y-2 text-[11px]">
                          <p className="text-white/80">Updates will be coming soon if needed or if I get ideas.</p>
                          <p className="text-white/80"><span className="text-red-500">v1.0.0</span> is the current version you are using — more versions may come soon.</p>
                          <p className="text-white/80">I hope you enjoy my cord.</p>
                        </div>

                        <div className="pt-2">
                          <p className="text-xs text-white font-bold">LET'S PACK 😂 jokes. Na fr come pack wit me <span className="text-red-500">🔥</span></p>
                        </div>
                      </div>
                    </div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
            
            <div style={{ display: activeTab === 'song' ? 'block' : 'none' }}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/60 rounded-2xl border border-red-500/20 p-6 min-h-[400px] glass-card"
              >
                <div className="space-y-8 flex flex-col items-center justify-center min-h-[350px]">
                  {/* Search Bar */}
                  <div className="relative w-full max-w-md flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch('module')}
                        placeholder="Search any song on YouTube..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                      />
                    </div>
                    <button 
                      onClick={() => handleSearch('module')}
                      disabled={isSearching}
                      className="px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    >
                      {isSearching ? '...' : 'Search'}
                    </button>
                  </div>

                  {/* Search Results */}
                  {renderVideoResults('module')}

                  <div className="text-center space-y-4 w-full max-w-md">
                    <div className="relative w-full aspect-video bg-red-700/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20 overflow-hidden group">
                      {songQueue[currentSongIndex]?.id && (
                        <img 
                          src={`https://img.youtube.com/vi/${songQueue[currentSongIndex]?.id}/hqdefault.jpg`} 
                          alt="Album Artwork" 
                          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg shadow-red-600/50 ${isPlaying ? 'scale-105' : ''}`}>
                          {isPlaying ? <Pause size={28} className="text-white" /> : <Play size={28} className="text-white ml-1" />}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                          {isPlaying ? 'Playing Audio' : 'Paused'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold italic font-display text-red-500">Now Playing</h2>
                      <p className="text-xs text-white/40 font-mono truncate max-w-[300px] mx-auto">
                        {songQueue[currentSongIndex]?.name || 'No song playing'}
                      </p>
                    </div>
                  </div>

                  <div className="w-full max-w-md space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden group cursor-pointer">
                        <div 
                          className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${songProgress}%` }}
                        />
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={songProgress}
                          onChange={handleSeek}
                          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 pointer-events-none"
                          style={{ left: `calc(${songProgress}% - 6px)` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-white/30">
                        <span>{Math.floor(songCurrentTime / 60)}:{Math.floor(songCurrentTime % 60).toString().padStart(2, '0')}</span>
                        <span>{Math.floor(songDuration / 60)}:{Math.floor(songDuration % 60).toString().padStart(2, '0')}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={toggleShuffle}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${shuffleMode ? 'bg-red-700/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                        title="Shuffle"
                      >
                        <Shuffle size={18} />
                      </button>
                      <button 
                        onClick={toggleRepeat}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${loopMode ? 'bg-red-700/20 border-red-500 text-red-300 shadow-[0_0_18px_rgba(239,68,68,.22)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                        title="Loop current song"
                      >
                        <Repeat size={18} />
                      </button>
                      <button 
                        onClick={handlePrevious}
                        className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all text-white/60 hover:text-white"
                        title="Previous Song"
                      >
                        <SkipBack size={20} fill="currentColor" />
                      </button>
                      <button 
                        onClick={togglePlay}
                        className="w-14 h-14 bg-red-700 rounded-full flex items-center justify-center shadow-lg shadow-red-600/20 transition-all"
                      >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                      </button>
                      <button 
                        onClick={handleSkip}
                        className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition-all text-white/60 hover:text-white"
                        title="Next Song"
                      >
                        <SkipForward size={20} fill="currentColor" />
                      </button>
                    </div>

                    {/* Volume Control */}
                    <div className="flex items-center gap-4 bg-black/40 border border-white/5 rounded-xl px-4 py-3">
                      <button onClick={toggleMute} className="text-white/40 hover:text-white transition-colors">
                        {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="flex-1 accent-red-500 h-1.5 rounded-full appearance-none bg-white/10"
                      />
                      <span className="text-[10px] font-mono text-white/40 w-8">{isMuted ? 0 : volume}%</span>
                    </div>
                  </div>

                  {/* Full Song Queue & Track Library */}
                  <div className="w-full max-w-md bg-black/50 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Music size={14} className="text-red-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          Song Queue ({songQueue.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => playSongAtIndex(0)}
                          className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-[9px] font-bold uppercase transition-all"
                          title="Play Startup Song: 01. Slendo - Intro"
                        >
                          Intro Track
                        </button>
                        <button
                          onClick={resetQueueToDefault}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 text-[9px] font-bold uppercase transition-all"
                          title="Reset to original songs"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Filter Queue */}
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                      <input 
                        type="text"
                        value={queueFilter}
                        onChange={(e) => setQueueFilter(e.target.value)}
                        placeholder="Filter queue by number or artist..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-[11px] focus:outline-none focus:border-red-500/50"
                      />
                    </div>

                    {/* Scrollable Song List */}
                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                      {songQueue
                        .map((song, index) => ({ song, index }))
                        .filter(({ song }) => {
                          if (!queueFilter) return true;
                          const q = queueFilter.toLowerCase();
                          return song.name.toLowerCase().includes(q) || song.id.toLowerCase().includes(q);
                        })
                        .map(({ song, index }) => {
                          const isCurrent = currentSongIndex === index;
                          const isIntro = song.id === 'ijHvVG20DNg';
                          return (
                            <button
                              key={`${song.id}-${index}`}
                              onClick={() => playSongAtIndex(index)}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all group ${
                                isCurrent 
                                  ? 'bg-red-700/20 border border-red-500/40 text-red-400 shadow-sm' 
                                  : 'hover:bg-white/5 text-white/60 hover:text-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={`text-[10px] font-mono font-bold w-6 text-center ${isCurrent ? 'text-red-400' : 'text-white/30'}`}>
                                  {index + 1}
                                </span>
                                <span className="text-xs truncate font-medium">
                                  {song.name}
                                </span>
                                {isIntro && (
                                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/30 shrink-0">
                                    Startup
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 pl-2">
                                {isCurrent && isPlaying ? (
                                  <div className="flex items-center gap-0.5">
                                    <div className="w-0.5 h-3 bg-red-500 animate-pulse" />
                                    <div className="w-0.5 h-4 bg-red-400 animate-pulse delay-75" />
                                    <div className="w-0.5 h-2 bg-red-500 animate-pulse delay-150" />
                                  </div>
                                ) : (
                                  <Play size={12} className="opacity-0 group-hover:opacity-100 text-red-400 transition-opacity" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            </div>
          </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-red-500/20 mt-12 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-red-500/40 font-bold">Slendo v1.0.0</p>
          <p className="text-[9px] text-white/10 max-w-md mx-auto">
            This tool is for educational purposes only. Automated user accounts (self-bots) are against Discord's Terms of Service and may result in account termination.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default CordApp;
