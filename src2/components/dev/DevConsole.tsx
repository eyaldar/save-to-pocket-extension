import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'error' | 'warning';
}

interface DevConsoleProps {
  visible: boolean;
}

// Create a global log collector
const logBuffer: LogEntry[] = [];
const MAX_LOGS = 100;

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Function to add log entry to buffer
const addLog = (message: string, type: LogEntry['type']) => {
  // Convert objects to strings
  const formattedMessage = typeof message === 'object' 
    ? JSON.stringify(message, null, 2) 
    : String(message);
  
  logBuffer.unshift({
    message: formattedMessage,
    timestamp: new Date(),
    type
  });
  
  // Trim buffer if exceeds max size
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.pop();
  }
  
  // Dispatch event to notify console component
  window.dispatchEvent(new CustomEvent('dev-console-log-update'));
};

// Override console methods
console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  addLog(args.join(' '), 'info');
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
  addLog(args.join(' '), 'error');
};

console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
  addLog(args.join(' '), 'warning');
};

const DevConsole: React.FC<DevConsoleProps> = ({ visible }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [showTypes, setShowTypes] = useState({
    info: true,
    error: true,
    warning: true
  });
  const consoleRef = useRef<HTMLDivElement>(null);

  // Update logs when buffer changes
  useEffect(() => {
    const handleLogUpdate = () => {
      setLogs([...logBuffer]);
    };
    
    // Initial load
    handleLogUpdate();
    
    // Listen for updates
    window.addEventListener('dev-console-log-update', handleLogUpdate);
    
    return () => {
      window.removeEventListener('dev-console-log-update', handleLogUpdate);
    };
  }, []);

  // Filter logs based on search term and type filters
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter 
      ? log.message.toLowerCase().includes(filter.toLowerCase()) 
      : true;
    
    const matchesType = showTypes[log.type];
    
    return matchesFilter && matchesType;
  });

  // Toggle log type visibility
  const toggleType = (type: keyof typeof showTypes) => {
    setShowTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Clear logs
  const clearLogs = () => {
    logBuffer.length = 0;
    setLogs([]);
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour12: false });
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white h-64 flex flex-col border-t border-gray-700 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="text-sm font-medium">Developer Console</div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-xs">
              <input
                type="checkbox"
                checked={showTypes.info}
                onChange={() => toggleType('info')}
                className="mr-1"
              />
              Info
            </label>
            <label className="text-xs">
              <input
                type="checkbox"
                checked={showTypes.error}
                onChange={() => toggleType('error')}
                className="mr-1"
              />
              Errors
            </label>
            <label className="text-xs">
              <input
                type="checkbox"
                checked={showTypes.warning}
                onChange={() => toggleType('warning')}
                className="mr-1"
              />
              Warnings
            </label>
          </div>
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded w-32"
          />
          <button
            onClick={clearLogs}
            className="text-xs px-2 py-1 bg-red-600 rounded hover:bg-red-700"
          >
            Clear
          </button>
        </div>
      </div>
      <div 
        ref={consoleRef}
        className="flex-1 overflow-auto p-2 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 italic p-2">No logs to display</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index} 
              className={`mb-1 border-l-2 pl-2 ${
                log.type === 'error' 
                  ? 'border-red-500 text-red-300' 
                  : log.type === 'warning' 
                    ? 'border-yellow-500 text-yellow-300' 
                    : 'border-blue-500 text-gray-300'
              }`}
            >
              <span className="text-gray-500 mr-2">[{formatTime(log.timestamp)}]</span>
              <span className="whitespace-pre-wrap">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DevConsole; 