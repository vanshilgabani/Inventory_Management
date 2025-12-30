const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatLogMessage = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: getTimestamp(),
    level,
    message,
    ...meta
  });
};

const writeToFile = (level, message) => {
  const filename = `${level.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`;
  const filepath = path.join(logsDir, filename);
  
  fs.appendFile(filepath, message + '\n', (err) => {
    if (err) console.error('Failed to write log:', err);
  });
};

const logger = {
  error: (message, meta = {}) => {
    const logMessage = formatLogMessage(logLevels.ERROR, message, meta);
    console.error(`❌ ${message}`, meta);
    writeToFile(logLevels.ERROR, logMessage);
  },
  
  warn: (message, meta = {}) => {
    const logMessage = formatLogMessage(logLevels.WARN, message, meta);
    console.warn(`⚠️ ${message}`, meta);
    writeToFile(logLevels.WARN, logMessage);
  },
  
  info: (message, meta = {}) => {
    const logMessage = formatLogMessage(logLevels.INFO, message, meta);
    console.log(`ℹ️ ${message}`, meta);
    if (process.env.NODE_ENV === 'production') {
      writeToFile(logLevels.INFO, logMessage);
    }
  },
  
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 ${message}`, meta);
    }
  }
};

module.exports = logger;
