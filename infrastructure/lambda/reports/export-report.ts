import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// Note: In production, install @aws-sdk/s3-request-presigner package
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const sesClient = new SESClient({});

interface ExportRequest {
  reportId?: string;
  reportData?: any;
  format: 'pdf' | 'csv' | 'excel';
  options?: ExportOptions;
  delivery?: DeliveryOptions;
}

interface ExportOptions {
  includeCharts?: boolean;
  includeRawData?: boolean;
  template?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal';
  compression?: boolean;
  password?: string;
  expiresIn?: number; // hours
}

interface DeliveryOptions {
  email?: string[];
  subject?: string;
  message?: string;
  downloadLink?: boolean;
  expiresIn?: number; // hours
}

interface ExportResponse {
  exportId: string;
  format: string;
  status: 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  fileSize?: number;
  generatedAt: string;
  deliveryStatus?: {
    email?: 'sent' | 'failed';
    recipients?: string[];
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Export report request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    const userEmail = user?.email;
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request body
    let exportRequest: ExportRequest;
    try {
      exportRequest = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!exportRequest.format) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FORMAT',
            message: 'Export format is required',
          },
        }),
      };
    }

    // Validate format
    const validFormats = ['pdf', 'csv', 'excel'];
    if (!validFormats.includes(exportRequest.format)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: `Format must be one of: ${validFormats.join(', ')}`,
          },
        }),
      };
    }

    // Get report data
    let reportData;
    if (exportRequest.reportId) {
      reportData = await getReportData(exportRequest.reportId, userId, userRole);
      if (!reportData) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'REPORT_NOT_FOUND',
              message: 'Report not found or access denied',
            },
          }),
        };
      }
    } else if (exportRequest.reportData) {
      reportData = exportRequest.reportData;
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_DATA',
            message: 'Either reportId or reportData is required',
          },
        }),
      };
    }

    // Generate export
    const exportResult = await generateExport(
      reportData,
      exportRequest.format,
      exportRequest.options || {},
      userId,
      userEmail
    );

    // Handle delivery if requested
    if (exportRequest.delivery) {
      await handleDelivery(exportResult, exportRequest.delivery, userEmail);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: exportResult,
      }),
    };

  } catch (error) {
    console.error('Error exporting report:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export report',
        },
      }),
    };
  }
};

async function getReportData(reportId: string, userId: string, userRole: string): Promise<any> {
  // This would typically fetch from the report cache or regenerate
  // For now, return null to indicate not found
  try {
    const cacheTable = process.env.REPORT_CACHE_TABLE_NAME;
    if (!cacheTable) {
      return null;
    }

    const command = new GetCommand({
      TableName: cacheTable,
      Key: { cacheKey: reportId },
    });
    
    const result = await docClient.send(command);
    
    if (result.Item && result.Item.expiresAt > Date.now()) {
      return result.Item.reportData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching report data:', error);
    return null;
  }
}

async function generateExport(
  reportData: any,
  format: string,
  options: ExportOptions,
  userId: string,
  userEmail?: string
): Promise<ExportResponse> {
  const exportId = randomUUID();
  const timestamp = new Date().toISOString();
  
  let fileContent: Buffer;
  let contentType: string;
  let fileExtension: string;

  switch (format) {
    case 'csv':
      fileContent = await generateCSV(reportData, options);
      contentType = 'text/csv';
      fileExtension = 'csv';
      break;
    
    case 'excel':
      fileContent = await generateExcel(reportData, options);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileExtension = 'xlsx';
      break;
    
    case 'pdf':
      fileContent = await generatePDF(reportData, options);
      contentType = 'application/pdf';
      fileExtension = 'pdf';
      break;
    
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Upload to S3
  const fileName = `exports/${userId}/${exportId}.${fileExtension}`;
  const uploadResult = await uploadToS3(fileName, fileContent, contentType);
  
  // Generate signed URL for download
  const downloadUrl = await generateDownloadUrl(fileName, options.expiresIn || 24);

  return {
    exportId,
    format,
    status: 'completed',
    downloadUrl,
    expiresAt: new Date(Date.now() + (options.expiresIn || 24) * 60 * 60 * 1000).toISOString(),
    fileSize: fileContent.length,
    generatedAt: timestamp,
  };
}

async function generateCSV(reportData: any, options: ExportOptions): Promise<Buffer> {
  try {
    let csvContent = '';
    
    // Add header with report info
    csvContent += `Report Type,${reportData.reportType}\n`;
    csvContent += `Generated At,${reportData.generatedAt}\n`;
    csvContent += `Report ID,${reportData.reportId}\n`;
    csvContent += '\n';

    // Add summary section
    if (reportData.summary) {
      csvContent += 'SUMMARY\n';
      Object.entries(reportData.summary).forEach(([key, value]) => {
        csvContent += `${key},${value}\n`;
      });
      csvContent += '\n';
    }

    // Add main data
    if (reportData.data && reportData.data.length > 0) {
      csvContent += 'DETAILED DATA\n';
      
      // Headers
      const headers = Object.keys(reportData.data[0]);
      csvContent += headers.join(',') + '\n';
      
      // Data rows
      reportData.data.forEach((row: any) => {
        const values = headers.map(header => {
          let value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            value = `"${value}"`;
          }
          return value || '';
        });
        csvContent += values.join(',') + '\n';
      });
    }

    return Buffer.from(csvContent, 'utf-8');
  } catch (error) {
    console.error('Error generating CSV:', error);
    throw new Error('Failed to generate CSV export');
  }
}

async function generateExcel(reportData: any, options: ExportOptions): Promise<Buffer> {
  try {
    // Simplified Excel generation - in production, use a library like ExcelJS
    const workbookData = {
      worksheets: [
        {
          name: 'Summary',
          data: reportData.summary ? Object.entries(reportData.summary).map(([key, value]) => [key, value]) : []
        },
        {
          name: 'Data',
          data: reportData.data || []
        }
      ]
    };

    // For now, return CSV format as Excel isn't fully implemented
    // In production, implement proper Excel generation with formatting
    const csvBuffer = await generateCSV(reportData, options);
    return csvBuffer;
  } catch (error) {
    console.error('Error generating Excel:', error);
    throw new Error('Failed to generate Excel export');
  }
}

async function generatePDF(reportData: any, options: ExportOptions): Promise<Buffer> {
  try {
    // Simplified PDF generation - in production, use Puppeteer or similar
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportData.reportType} Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .summary { background-color: #f5f5f5; padding: 15px; margin-bottom: 20px; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .data-table th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${reportData.reportType.toUpperCase()} Report</h1>
          <p>Generated: ${new Date(reportData.generatedAt).toLocaleString()}</p>
          <p>Report ID: ${reportData.reportId}</p>
        </div>
    `;

    // Add summary
    if (reportData.summary) {
      htmlContent += '<div class="summary"><h2>Summary</h2>';
      Object.entries(reportData.summary).forEach(([key, value]) => {
        htmlContent += `<p><strong>${key}:</strong> ${value}</p>`;
      });
      htmlContent += '</div>';
    }

    // Add data table
    if (reportData.data && reportData.data.length > 0) {
      htmlContent += '<h2>Detailed Data</h2>';
      htmlContent += '<table class="data-table">';
      
      // Headers
      const headers = Object.keys(reportData.data[0]);
      htmlContent += '<tr>';
      headers.forEach(header => {
        htmlContent += `<th>${header}</th>`;
      });
      htmlContent += '</tr>';
      
      // Data rows
      reportData.data.forEach((row: any) => {
        htmlContent += '<tr>';
        headers.forEach(header => {
          htmlContent += `<td>${row[header] || ''}</td>`;
        });
        htmlContent += '</tr>';
      });
      
      htmlContent += '</table>';
    }

    htmlContent += '</body></html>';

    // For now, return HTML as PDF generation requires Puppeteer
    // In production, convert HTML to PDF using Puppeteer
    return Buffer.from(htmlContent, 'utf-8');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF export');
  }
}

async function uploadToS3(fileName: string, content: Buffer, contentType: string): Promise<any> {
  const bucketName = process.env.EXPORTS_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('EXPORTS_BUCKET_NAME environment variable not set');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: content,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  return await s3Client.send(command);
}

async function generateDownloadUrl(fileName: string, expiresInHours: number): Promise<string> {
  const bucketName = process.env.EXPORTS_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('EXPORTS_BUCKET_NAME environment variable not set');
  }

  // In production, use getSignedUrl from @aws-sdk/s3-request-presigner
  // For now, return a placeholder URL
  return `https://${bucketName}.s3.amazonaws.com/${fileName}?expires=${Date.now() + (expiresInHours * 60 * 60 * 1000)}`;
}

async function handleDelivery(
  exportResult: ExportResponse,
  delivery: DeliveryOptions,
  userEmail?: string
): Promise<void> {
  try {
    if (delivery.email && delivery.email.length > 0) {
      await sendEmailDelivery(exportResult, delivery, userEmail);
      exportResult.deliveryStatus = {
        email: 'sent',
        recipients: delivery.email,
      };
    }
  } catch (error) {
    console.error('Error handling delivery:', error);
    if (exportResult.deliveryStatus) {
      exportResult.deliveryStatus.email = 'failed';
    }
  }
}

async function sendEmailDelivery(
  exportResult: ExportResponse,
  delivery: DeliveryOptions,
  userEmail?: string
): Promise<void> {
  const fromEmail = process.env.FROM_EMAIL || 'noreply@aerotage.com';
  
  const subject = delivery.subject || `Report Export - ${exportResult.format.toUpperCase()}`;
  const message = delivery.message || 'Your requested report export is ready for download.';
  
  let htmlBody = `
    <html>
      <body>
        <h2>Report Export Ready</h2>
        <p>${message}</p>
        <p><strong>Export Details:</strong></p>
        <ul>
          <li>Format: ${exportResult.format.toUpperCase()}</li>
          <li>File Size: ${Math.round(exportResult.fileSize! / 1024)} KB</li>
          <li>Generated: ${new Date(exportResult.generatedAt).toLocaleString()}</li>
          <li>Expires: ${new Date(exportResult.expiresAt!).toLocaleString()}</li>
        </ul>
  `;

  if (delivery.downloadLink && exportResult.downloadUrl) {
    htmlBody += `
        <p><a href="${exportResult.downloadUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Report</a></p>
        <p><small>This download link will expire in ${delivery.expiresIn || 24} hours.</small></p>
    `;
  }

  htmlBody += `
        <p>Best regards,<br>Aerotage Team</p>
      </body>
    </html>
  `;

  const textBody = `
Report Export Ready

${message}

Export Details:
- Format: ${exportResult.format.toUpperCase()}
- File Size: ${Math.round(exportResult.fileSize! / 1024)} KB
- Generated: ${new Date(exportResult.generatedAt).toLocaleString()}
- Expires: ${new Date(exportResult.expiresAt!).toLocaleString()}

${delivery.downloadLink && exportResult.downloadUrl ? 
  `Download Link: ${exportResult.downloadUrl}\n\nThis download link will expire in ${delivery.expiresIn || 24} hours.` : 
  'Please contact support for download instructions.'
}

Best regards,
Aerotage Team
  `;

  for (const email of delivery.email!) {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await sesClient.send(command);
  }
} 