package com.opentorrent.client;

import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "FileExplorer")
public class FileExplorerPlugin extends Plugin {

    public FileExplorerPlugin() {}

    @PluginMethod
    public void listFolder(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }

        try {
            File dir = new File(path);
            if (!dir.exists() || !dir.isDirectory()) {
                call.reject("Path is not a valid directory");
                return;
            }

            File[] entries = dir.listFiles();
            JSArray folders = new JSArray();
            if (entries != null) {
                for (File entry : entries) {
                    if (entry.isDirectory() && !entry.isHidden() && !entry.getName().startsWith(".")) {
                        JSObject obj = new JSObject();
                        obj.put("name", entry.getName());
                        obj.put("path", entry.getAbsolutePath());
                        folders.put(obj);
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("folders", folders);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list folder: " + e.getLocalizedMessage());
        }
    }

    @PluginMethod
    public void openFolder(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }

        try {
            String relativePath = path.replace("/storage/emulated/0/", "").replace("/storage/emulated/0", "");
            Uri uri = Uri.parse("content://com.android.externalstorage.documents/document/primary:" + relativePath);
            
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "vnd.android.document/directory");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Could not open file explorer: " + ex.getLocalizedMessage());
            }
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }

        File file = new File(path);
        if (!file.exists()) {
            call.reject("File does not exist: " + path);
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            String ext = MimeTypeMap.getFileExtensionFromUrl(Uri.fromFile(file).toString());
            String mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
            if (mimeType == null) mimeType = "*/*";

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open file: " + e.getLocalizedMessage());
        }
    }
}
