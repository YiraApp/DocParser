/**
 * Webhook & WebSocket Testing Helper
 * 
 * This file provides helper functions to test the webhook and WebSocket integration
 * from the browser console or as a test utility.
 * 
 * Usage in browser console:
 * fetch('/__debug/webhook-test')
 *   .then(r => r.json())
 *   .then(console.log)
 */

/**
 * Test webhook call
 * Simulates external system calling the webhook endpoint
 */
export async function testWebhookCall(documentId: string = 'test-' + Date.now()) {
  console.log(`[TEST] Sending test webhook for documentId: ${documentId}`);

  try {
    const response = await fetch('/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: documentId,
        report_id: 'test-report-' + documentId,
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        status: 'completed',
        timestamp: new Date().toISOString(),
        parsed_data: {
          patient_name: 'Test Patient ' + new Date().toLocaleTimeString(),
          diagnosis: 'Test Diagnosis',
          clinician_name: 'Dr. Test',
          encounter_date: new Date().toISOString().split('T')[0],
          lab_results: [
            {
              examination_name: 'Blood Work',
              tests: [
                {
                  test_name: 'Hemoglobin',
                  result: '15.5',
                  unit: 'g/dL',
                  reference_range: '13.5-17.5',
                  status: 'normal',
                },
              ],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[TEST] ? Webhook sent successfully:', data);
    return data;
  } catch (error) {
    console.error('[TEST] ? Webhook failed:', error);
    throw error;
  }
}

/**
 * Check WebSocket connection status
 */
export function checkWebSocketStatus() {
  try {
    // Try to access Socket.IO instance from window
    const io = (window as any).io;
    const socket = io && io.sockets && io.sockets[0];

    if (!socket) {
      console.warn('[TEST] ?? Socket.IO not found in window');
      return null;
    }

    console.log('[TEST] WebSocket Status:', {
      connected: socket.connected,
      id: socket.id,
      url: socket.io.uri,
    });

    return socket;
  } catch (error) {
    console.error('[TEST] Error checking WebSocket status:', error);
    return null;
  }
}

/**
 * Check recent documents list
 */
export async function checkRecentDocuments() {
  console.log('[TEST] Fetching recent documents...');

  try {
    const response = await fetch('/api/recent-documents?page=1&limit=5', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[TEST] ? Recent documents:', data);
    return data;
  } catch (error) {
    console.error('[TEST] ? Failed to fetch recent documents:', error);
    throw error;
  }
}

/**
 * Monitor WebSocket events for 10 seconds
 */
export function monitorWebSocketEvents(duration = 10000) {
  console.log(`[TEST] ?? Monitoring WebSocket events for ${duration / 1000}s...`);

  const eventLog: any[] = [];
  const startTime = Date.now();

  // Hook into console to capture logs
  const originalLog = console.log;
  const originalWarn = console.warn;

  const captureLog = (message: string, ...args: any[]) => {
    if (message.includes('[WEBSOCKET]') || message.includes('[SIDEBAR]')) {
      eventLog.push({
        type: 'log',
        message,
        args,
        timestamp: new Date(),
      });
    }
    originalLog.call(console, message, ...args);
  };

  console.log = captureLog;
  console.warn = (...args: any[]) => {
    if (String(args[0]).includes('[WEBSOCKET]') || String(args[0]).includes('[SIDEBAR]')) {
      eventLog.push({
        type: 'warn',
        message: args[0],
        args: args.slice(1),
        timestamp: new Date(),
      });
    }
    originalWarn.call(console, ...args);
  };

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.log('[TEST] ? Monitoring complete. Event log:', eventLog);
      resolve(eventLog);
    }, duration);
  });
}

/**
 * Full integration test
 * 1. Check WebSocket connection
 * 2. Get initial document list
 * 3. Send test webhook
 * 4. Monitor for status updates
 * 5. Check final document list
 */
export async function runFullTest() {
  console.log('[TEST] ?? Starting full integration test...');

  try {
    // Step 1: Check WebSocket
    console.log('\n[TEST] Step 1: Checking WebSocket connection...');
    checkWebSocketStatus();

    // Step 2: Get initial docs
    console.log('\n[TEST] Step 2: Fetching initial document list...');
    const initialDocs = await checkRecentDocuments();
    const initialCount = initialDocs.documents?.length || 0;

    // Step 3: Send webhook
    console.log('\n[TEST] Step 3: Sending test webhook...');
    const monitorPromise = monitorWebSocketEvents(15000);
    const webhookResult = await testWebhookCall();

    // Step 4: Wait for status updates
    console.log('\n[TEST] Step 4: Waiting for status updates...');
    const events = await monitorPromise;

    // Step 5: Check final docs
    console.log('\n[TEST] Step 5: Checking final document list...');
    const finalDocs = await checkRecentDocuments();
    const finalCount = finalDocs.documents?.length || 0;

    console.log('\n[TEST] ? Full integration test complete!');
    console.log('[TEST] Summary:', {
      initialDocumentCount: initialCount,
      finalDocumentCount: finalCount,
      newDocumentsAdded: finalCount - initialCount,
      webhookJobId: webhookResult.job_id,
      statusUpdatesCaptured: events.length,
    });

    return {
      success: true,
      webhookResult,
      events,
      initialDocs,
      finalDocs,
    };
  } catch (error) {
    console.error('[TEST] ? Full integration test failed:', error);
    throw error;
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).webhookTestUtils = {
    testWebhookCall,
    checkWebSocketStatus,
    checkRecentDocuments,
    monitorWebSocketEvents,
    runFullTest,
  };
}
