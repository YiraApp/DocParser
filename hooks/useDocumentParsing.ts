import { useState, useEffect, useCallback } from 'react';

interface ParsedDocument {
  id: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  jobId: string;
  parsedData?: any;
  structuredData?: any;
  errorMessage?: string;
}

export function useDocumentParsing(documentId: string | null) {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/documents/parsed-results?document_id=${documentId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const data = await response.json();
      setDocument(data.document);
      setError(null);

      // Continue polling if still processing
      if (data.document.status === 'processing') {
        const timeout = setTimeout(() => {
          fetchDocument();
        }, 2000); // Poll every 2 seconds

        return () => clearTimeout(timeout);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      fetchDocument();
    }
  }, [documentId, fetchDocument]);

  return { document, loading, error };
}