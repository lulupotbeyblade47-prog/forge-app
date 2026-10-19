package com.lulu.forge;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ForgeUpdater")
public class ForgeUpdaterPlugin extends Plugin {
    @PluginMethod
    public void openApk(PluginCall call) {
        String url = call.getString("url");
        Uri uri = url == null ? null : Uri.parse(url);
        boolean firebaseApk = uri != null && "forge-e1f5b.web.app".equals(uri.getHost())
                && "/forge.apk".equals(uri.getPath());
        boolean githubReleaseApk = uri != null && "github.com".equals(uri.getHost())
                && uri.getPath() != null && uri.getPath().contains("/releases/download/")
                && uri.getPath().endsWith(".apk");
        if (uri == null || !"https".equals(uri.getScheme()) || !(firebaseApk || githubReleaseApk)) {
            call.reject("Adresse de mise à jour invalide.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Aucun navigateur ne peut télécharger la mise à jour.", e);
        }
    }
}
