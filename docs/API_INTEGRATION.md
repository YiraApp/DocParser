# ... existing code ...

## Error Responses

### Authentication Errors

**401 Unauthorized**
\`\`\`json
{
  "error": "Invalid API key"
}
\`\`\`

**403 Forbidden**
\`\`\`json
{
  "error": "Tenant account is inactive"
}
\`\`\`

### Validation Errors

**400 Bad Request**
\`\`\`json
{
  "error": "No file provided"
}
\`\`\`

**400 Bad Request**
\`\`\`json
{
  "error": "Only PDF, PNG, JPG, and JPEG files are supported"
}
\`\`\`

### Queue Limit Errors

**429 Too Many Requests**
\`\`\`json
{
  "error": "Processing queue limit reached",
  "message": "Your basic tier allows 10 concurrent jobs. Currently processing: 10. Please wait for existing jobs to complete.",
  "queue_limit": 10,
  "current_queue_size": 10,
  "tier": "basic"
}
\`\`\`

**What to do when you receive a 429:**
- Wait for existing jobs to complete (check job status endpoint)
- Implement exponential backoff retry logic (recommended wait: 30-60 seconds)
- Upgrade your tier for higher concurrent processing capacity
- Use the `queue_position` field in responses to estimate wait time

### Server Errors

**500 Internal Server Error**
\`\`\`json
{
  "error": "Failed to create processing job"
}
\`\`\`

## Webhook Callbacks

When document processing completes, the system sends a POST request to your callback URL.

### Callback Request Headers

\`\`\`
Content-Type: application/json
X-Webhook-Event: document.processing.completed
\`\`\`

### Success Callback Body

\`\`\`json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "timestamp": "2024-01-15T10:32:15Z",
  "document": {
    "id": "660e9511-f39c-52e5-b827-557766551111",
    "patient_name": "John Doe",
    "file_name": "discharge_summary.pdf",
    "document_type": "Discharge Summary",
    "confidence_score": 92,
    "created_at": "2024-01-15T10:32:15Z",
    "structured_data": {
      "patientInfo": {
        "name": "John Doe",
        "dateOfBirth": "1980-05-15",
        "gender": "Male",
        "mrNumber": "MRN123456",
        "contactNumber": "+91-9876543210",
        "address": "123 Main St, Mumbai, MH 400001"
      },
      "clinicalData": {
        "chiefComplaint": "Chest pain and shortness of breath",
        "diagnosis": ["Type 2 Diabetes Mellitus", "Hypertension"],
        "medications": [
          {
            "name": "Metformin",
            "dosage": "500mg",
            "frequency": "Twice daily",
            "route": "Oral"
          }
        ],
        "labResults": [
          {
            "test": "HbA1c",
            "measuredValue": "7.2",
            "unit": "%",
            "referenceRange": "4.0-6.0",
            "status": "High",
            "datePerformed": "2024-01-10"
          }
        ],
        "vitalSigns": {
          "bloodPressure": "140/90 mmHg",
          "heartRate": "82 bpm",
          "temperature": "98.6°F",
          "respiratoryRate": "16/min"
        }
      },
      "billingInfo": {
        "totalAmount": "₹15,000",
        "consultationFee": "₹1,500",
        "labCharges": "₹3,500",
        "medicationCharges": "₹5,000",
        "paymentStatus": "Paid",
        "insuranceClaim": "₹10,000"
      },
      "metadata": {
        "confidenceScore": 92,
        "confidenceReason": "All major fields extracted with high certainty. Clear document quality.",
        "pagesProcessed": 5,
        "processingTimeSeconds": 135
      }
    }
  }
}
\`\`\`

### Webhook Handler Example (Express.js)

\`\`\`javascript
app.post('/webhook', express.json(), async (req, res) => {
  const { job_id, status, document } = req.body;
  
  console.log(`Job ${job_id} ${status}`);
  
  if (status === 'completed') {
    console.log('Document ID:', document.id);
    console.log('Patient:', document.patient_name);
    console.log('Confidence:', document.confidence_score);
    
    const patientInfo = document.structured_data.patientInfo;
    const clinicalData = document.structured_data.clinicalData;
    
    await saveToDatabase(document);
  } else {
    console.error('Processing failed:', document?.error || 'Unknown error');
  }
  
  res.status(200).json({ received: true });
});
\`\`\`

## Support & Resources

- **Email:** support@yira.ai
- **Documentation:** https://docs.yira.ai
- **Status Page:** https://status.yira.ai

## Summary

The Yira AI Document Parsing API provides a robust, tenant-based solution for extracting structured medical information from healthcare documents. Key features include:

- **Asynchronous Processing:** Submit documents and receive results via webhook callbacks when processing completes, eliminating timeout issues for large documents.
- **AI-Powered Extraction:** Powered by Google Gemini 2.5 Pro vision model for accurate extraction of patient information, clinical data, lab results with reference values, medications, and billing details.
- **Confidence Scoring:** Every parsed document includes a confidence score (0-100) to help you assess data quality and implement appropriate validation workflows.
- **Tenant Isolation:** Each customer receives a unique API key with isolated data storage and processing queues for security and compliance.
- **Queue Management:** Flexible concurrent processing limits based on subscription tier, with clear error responses when capacity is reached.
- **RESTful Design:** Simple HTTP endpoints with JSON payloads make integration straightforward in any programming language.

### Getting Started

Contact our team at support@yira.ai to obtain your API key and begin integrating intelligent document parsing into your healthcare workflows.

---

**Ready to Transform Your Document Processing?**

Join healthcare organizations already using Yira AI to automate claims processing, reduce manual data entry, and improve accuracy. Contact sales@yira.ai to learn more.

# ... existing code ...
