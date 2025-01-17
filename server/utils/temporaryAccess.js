class TokenManager {
  constructor() {
    this.tokens = new Map();
    this.maxTokensPerUser = 50;
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    this.startCleanupTask();
  }

  generateToken(filename, userId) {
    // Cleanup user's old tokens first
    this.cleanupUserTokens(userId);

    const token = require("crypto").randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    this.tokens.set(token, {
      filename,
      userId,
      expiresAt,
      createdAt: Date.now(),
    });

    return token;
  }

  validateToken(token) {
    const data = this.tokens.get(token);

    if (!data) {
      return null;
    }

    if (Date.now() > data.expiresAt) {
      console.log("Token expired:", { token, expiresAt: data.expiresAt });
      this.tokens.delete(token);
      return null;
    }
    return data;
  }

  cleanupUserTokens(userId) {
    let userTokenCount = 0;
    const now = Date.now();

    // Count and collect user's tokens
    const userTokens = Array.from(this.tokens.entries())
      .filter(([_, data]) => data.userId === userId)
      .sort((a, b) => b[1].createdAt - a[1].createdAt); // Sort by creation time

    // Remove expired and excess tokens
    userTokens.forEach(([token, data], index) => {
      if (data.expiresAt < now || index >= this.maxTokensPerUser) {
        this.tokens.delete(token);
      }
    });
  }

  startCleanupTask() {
    setInterval(() => {
      try {
        const now = Date.now();
        let totalTokens = 0;
        let expiredTokens = 0;

        for (const [token, data] of this.tokens.entries()) {
          totalTokens++;
          if (data.expiresAt < now) {
            this.tokens.delete(token);
            expiredTokens++;
          }
        }

        // Only log if there were expired tokens
        if (expiredTokens > 0) {
          console.log(
            `Cleanup task: removed ${expiredTokens}/${totalTokens} expired tokens`
          );
        }
      } catch (error) {
        console.error("Token cleanup task error:", error);
      }
    }, this.cleanupInterval);
  }

  getStats() {
    const now = Date.now();
    const stats = {
      totalTokens: this.tokens.size,
      activeTokens: 0,
      expiredTokens: 0,
      tokensPerUser: new Map(),
    };

    for (const [_, data] of this.tokens.entries()) {
      if (data.expiresAt > now) {
        stats.activeTokens++;
      } else {
        stats.expiredTokens++;
      }

      const userCount = stats.tokensPerUser.get(data.userId) || 0;
      stats.tokensPerUser.set(data.userId, userCount + 1);
    }

    return stats;
  }
}

// Export a singleton instance
module.exports = new TokenManager();
