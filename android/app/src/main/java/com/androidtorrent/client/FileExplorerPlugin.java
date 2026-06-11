package com.androidtorrent.client;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FileExplorer")
public class FileExplorerPlugin extends Plugin {

    public FileExplorerPlugin() {}

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
}
