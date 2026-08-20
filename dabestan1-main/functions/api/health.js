export async function onRequest(context) {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'دبستان API is running!',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
