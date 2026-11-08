import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Service to manage private receipt images in Supabase Storage (bucket: 'receipts')
 */
export const supabaseStorage = {
  /**
   * Ensures the private 'receipts' storage bucket exists
   */
  async ensureReceiptsBucket(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { data, error } = await supabase.storage.getBucket('receipts');
      if (!error && data) return true;

      // Attempt to create bucket if allowed by caller permissions
      const { error: createErr } = await supabase.storage.createBucket('receipts', {
        public: false,
        fileSizeLimit: 15 * 1024 * 1024, // 15MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });

      return !createErr;
    } catch (err) {
      console.warn('ensureReceiptsBucket notice:', err);
      return false;
    }
  },

  /**
   * Uploads receipt image to secure group folder: <groupId>/<timestamp>_receipt.<ext>
   * Returns relative storage path and a signed URL (valid for 1 hour)
   */
  async uploadReceiptImage(
    groupId: string,
    fileOrBase64: File | Blob | string,
    filename: string = 'receipt.jpg'
  ): Promise<{ path: string; signedUrl?: string } | null> {
    if (!isSupabaseConfigured) return null;
    try {
      await this.ensureReceiptsBucket();

      const timestamp = Date.now();
      const ext = filename.split('.').pop() || 'jpg';
      const cleanPath = `${groupId}/${timestamp}_receipt.${ext}`;

      let fileToUpload: File | Blob;
      if (typeof fileOrBase64 === 'string') {
        if (fileOrBase64.startsWith('data:')) {
          const res = await fetch(fileOrBase64);
          fileToUpload = await res.blob();
        } else {
          return { path: fileOrBase64, signedUrl: fileOrBase64 };
        }
      } else {
        fileToUpload = fileOrBase64;
      }

      const contentType = fileToUpload.type || 'image/jpeg';
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(cleanPath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType,
        });

      if (error || !data) {
        console.warn('Storage upload notice (private bucket):', error?.message);
        // Fall back to null so caller can handle gracefully
        return null;
      }

      // Generate signed URL (since bucket is private and unauthorized users cannot view)
      const { data: signData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(data.path, 3600); // 1 hour expiry

      return {
        path: data.path,
        signedUrl: signData?.signedUrl,
      };
    } catch (err) {
      console.error('uploadReceiptImage error:', err);
      return null;
    }
  },

  /**
   * Generates a temporary signed URL for a private receipt path (1 hour expiry)
   */
  async getReceiptSignedUrl(path: string): Promise<string | null> {
    if (!isSupabaseConfigured || !path) return null;
    // If it's already a full http or data URL, return as-is
    if (path.startsWith('http') || path.startsWith('data:')) {
      return path;
    }

    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 3600);

      if (error || !data) {
        console.warn('getReceiptSignedUrl notice:', error?.message);
        return null;
      }

      return data.signedUrl;
    } catch (err) {
      console.error('getReceiptSignedUrl error:', err);
      return null;
    }
  },

  /**
   * Deletes a receipt image from storage when the expense is deleted
   */
  async deleteReceiptImage(path: string): Promise<boolean> {
    if (!isSupabaseConfigured || !path) return false;
    if (path.startsWith('http') || path.startsWith('data:')) return true;

    try {
      const { error } = await supabase.storage.from('receipts').remove([path]);
      return !error;
    } catch (err) {
      console.error('deleteReceiptImage error:', err);
      return false;
    }
  },
};
