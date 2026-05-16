// Vercel serverless function adapter for TanStack Start
export default async function handler(req, res) {
  try {
    // Dynamically import the built server
    const serverModule = await import('../dist/server/index.js');
    
    // Get the default export (the worker fetch handler)
    const workerHandler = serverModule.default;
    
    if (!workerHandler || !workerHandler.fetch) {
      throw new Error('Invalid server module');
    }

    // Build the full URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${protocol}://${host}${req.url}`;

    // Create a Web API Request object
    const request = new Request(url, {
      method: req.method,
      headers: new Headers(req.headers),
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Call the Cloudflare Worker fetch handler
    const response = await workerHandler.fetch(request, {
      // Mock Cloudflare env
      ASSETS: { fetch: () => new Response(null, { status: 404 }) }
    });

    // Set response status
    res.status(response.status);

    // Copy headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send body
    const body = await response.text();
    res.send(body);
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
