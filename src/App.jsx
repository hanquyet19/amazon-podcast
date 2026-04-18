import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Save, Link as LinkIcon, Edit3, Globe, CheckCircle2 } from 'lucide-react';
import { Octokit } from '@octokit/rest';

const RSS_URL = 'https://corsproxy.io/?url=' + encodeURIComponent('https://anchor.fm/s/1110f80e0/podcast/rss');

export default function App() {
  const [config, setConfig] = useState(() => {
    return JSON.parse(localStorage.getItem('rssConfig')) || {
      token: '',
      owner: '',
      repo: ''
    };
  });

  const [episodes, setEpisodes] = useState([]);
  const [dataJson, setDataJson] = useState({ title: "Friendly Podcast For You", episodes: {} });
  const [dataJsonSha, setDataJsonSha] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(!config.token);
  
  const [editingEpisode, setEditingEpisode] = useState(null);
  const [editingLink, setEditingLink] = useState('');

  // Fetch Anchor RSS
  const fetchRSS = async () => {
    try {
      const currentUrl = 'https://anchor.fm/s/1110f80e0/podcast/rss?nocache=' + Date.now();
      const res = await fetch(currentUrl);
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const items = Array.from(xml.querySelectorAll('item'));
      
      const eps = items.map(item => ({
        title: item.querySelector('title')?.textContent || 'No title',
        guid: item.querySelector('guid')?.textContent || '',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        link: item.querySelector('link')?.textContent || '',
      }));
      setEpisodes(eps);
    } catch (e) {
      console.error('Failed to fetch RSS', e);
      alert('Failed to fetch RSS from Anchor.');
    }
  };

  // Fetch data.json from GitHub
  const fetchGitHubData = async () => {
    if (!config.token || !config.owner || !config.repo) return;
    try {
      const octokit = new Octokit({ auth: config.token });
      const res = await octokit.repos.getContent({
        owner: config.owner,
        repo: config.repo,
        path: 'data.json',
      });
      
      const content = atob(res.data.content);
      setDataJson(JSON.parse(content));
      setDataJsonSha(res.data.sha);
    } catch (e) {
      console.error('Failed to fetch data.json from GitHub', e);
      // Could be file doesn't exist yet, ignore
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await Promise.all([fetchRSS(), fetchGitHubData()]);
    setIsSyncing(false);
  };

  useEffect(() => {
    if (config.token && config.owner && config.repo) {
      handleSync();
    }
  }, []); // Run once on mount if config is set

  const saveConfig = () => {
    localStorage.setItem('rssConfig', JSON.stringify(config));
    setShowSettings(false);
    handleSync();
  };

  const saveLinkToData = () => {
    if (!editingEpisode) return;
    const newData = { ...dataJson };
    if (!newData.episodes) newData.episodes = {};
    newData.episodes[editingEpisode.guid] = editingLink;
    setDataJson(newData);
    setEditingEpisode(null);
  };

  const pushToGitHub = async () => {
    setIsSaving(true);
    try {
      const octokit = new Octokit({ auth: config.token });
      const contentBase64 = btoa(JSON.stringify(dataJson, null, 2));
      
      await octokit.repos.createOrUpdateFileContents({
        owner: config.owner,
        repo: config.repo,
        path: 'data.json',
        message: 'Update custom RSS links',
        content: contentBase64,
        sha: dataJsonSha || undefined
      });
      
      alert('Successfully pushed to GitHub! The GitHub Action will now run to generate and deploy your feed.');
      await fetchGitHubData(); // Refresh SHA
    } catch (e) {
      console.error('Failed to push to GitHub', e);
      alert('Failed to save to GitHub. Error: ' + (e.message || JSON.stringify(e)));
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto flex flex-col gap-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Podcast Sync Hub
          </h1>
          <p className="text-slate-500 mt-1">Manage your custom Spotify/Anchor episode links.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={pushToGitHub}
            disabled={isSaving || !dataJsonSha && Object.keys(dataJson.episodes).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition shadow-sm disabled:opacity-50 disabled:bg-slate-300"
          >
            <Save className="w-4 h-4" />
            Push to GitHub
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5" />
              GitHub Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Personal Access Token</label>
                <input 
                  type="password" 
                  value={config.token}
                  onChange={(e) => setConfig({...config, token: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  placeholder="ghp_xxxxxxxxxxxx"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Repo Owner</label>
                  <input 
                    type="text" 
                    value={config.owner}
                    onChange={(e) => setConfig({...config, owner: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    placeholder="username"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Repo Name</label>
                  <input 
                    type="text" 
                    value={config.repo}
                    onChange={(e) => setConfig({...config, repo: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    placeholder="podcast-repo"
                  />
                </div>
              </div>
              <button 
                onClick={saveConfig}
                className="w-full bg-slate-800 text-white rounded-lg py-2.5 font-medium hover:bg-slate-700 transition mt-4"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {editingEpisode && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Set Custom Link</h2>
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-600">Episode:</p>
              <p className="text-slate-800">{editingEpisode.title}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Custom Link URL</label>
              <input 
                type="text" 
                value={editingLink}
                onChange={(e) => setEditingLink(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                placeholder="https://..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveLinkToData()}
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setEditingEpisode(null)}
                className="px-4 py-2 font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={saveLinkToData}
                className="px-4 py-2 font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Title config & Episode List */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-6 pb-6 border-b border-slate-100">
          <label className="block text-sm font-medium text-slate-600 mb-2">Target Podcast Title</label>
          <input 
            type="text" 
            value={dataJson.title}
            onChange={(e) => setDataJson({...dataJson, title: e.target.value})}
            className="w-full max-w-md border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
          />
          <p className="text-xs text-slate-400 mt-2">This title will override "friendly-life" when the feed is generated.</p>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">
          Episodes ({episodes.length})
        </h3>
        
        {episodes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {isSyncing ? 'Fetching episodes...' : 'No episodes loaded. Click Refresh.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {episodes.map(ep => {
              const hasCustomLink = dataJson.episodes && dataJson.episodes[ep.guid];
              const customLink = dataJson.episodes ? dataJson.episodes[ep.guid] : null;

              return (
                <div key={ep.guid} className={`flex items-center justify-between p-4 rounded-xl border transition group ${hasCustomLink ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-white hover:border-blue-200'}`}>
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="font-semibold text-slate-800 truncate" title={ep.title}>{ep.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{new Date(ep.pubDate).toLocaleDateString()}</p>
                    
                    <div className="flex items-center gap-1.5 mt-2">
                      <LinkIcon className={`w-3.5 h-3.5 ${hasCustomLink ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <a 
                        href={hasCustomLink ? customLink : ep.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`text-sm truncate ${hasCustomLink ? 'text-emerald-600 hover:text-emerald-700 font-medium' : 'text-slate-400 hover:text-slate-600'} hover:underline`}
                      >
                        {hasCustomLink ? customLink : 'Default Anchor URL'}
                      </a>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setEditingEpisode(ep);
                      setEditingLink(customLink || '');
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      hasCustomLink 
                        ? 'text-emerald-600 bg-emerald-100 hover:bg-emerald-200'
                        : 'text-blue-600 bg-blue-50 hover:bg-blue-100 opacity-0 group-hover:opacity-100 focus:opacity-100'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    {hasCustomLink ? 'Edit Link' : 'Add Link'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
