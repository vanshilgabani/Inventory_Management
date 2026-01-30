// Real-time notification system using in-memory storage
// For production, use Redis or Socket.io

class RealtimeService {
  constructor() {
    this.subscribers = new Map(); // Map of userId -> callback functions
  }

  // Subscribe to real-time updates
  subscribe(userId, callback) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, []);
    }
    this.subscribers.get(userId).push(callback);
  }

  // Unsubscribe from updates
  unsubscribe(userId, callback) {
    if (this.subscribers.has(userId)) {
      const callbacks = this.subscribers.get(userId);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notify specific user
  notifyUser(userId, event, data) {
    if (this.subscribers.has(userId)) {
      const callbacks = this.subscribers.get(userId);
      callbacks.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('Error in realtime callback:', error);
        }
      });
    }
  }

  // Notify all users in an organization
  notifyOrganization(organizationId, event, data) {
    // In production, query all users in org and notify
    console.log(`Notifying organization ${organizationId}:`, event);
  }

  // Broadcast to all subscribers
  broadcast(event, data) {
    this.subscribers.forEach((callbacks, userId) => {
      callbacks.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('Error in broadcast callback:', error);
        }
      });
    });
  }
}

// Singleton instance
const realtimeService = new RealtimeService();

module.exports = realtimeService;
