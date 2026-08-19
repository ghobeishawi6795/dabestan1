// ========================================
// 🚀 دبستان API - Cloudflare Worker
// ========================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'دبستان API is running!',
        timestamp: new Date().toISOString()
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    // Test database connection
    if (url.pathname === '/api/test-db') {
      try {
        const result = await env.DB.prepare("SELECT name FROM schools LIMIT 1").first();
        return new Response(JSON.stringify({ 
          status: 'ok', 
          message: 'Database connected!',
          data: result
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          status: 'error', 
          message: 'Database error',
          error: error.message
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
    }
    
    // Default response
    return new Response(JSON.stringify({ 
      message: 'Welcome to Dabestan API',
      version: '1.0.0',
      endpoints: [
        '/api/health',
        '/api/test-db'
      ]
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
};
