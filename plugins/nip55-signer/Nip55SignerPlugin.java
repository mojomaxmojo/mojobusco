package co.mojobus.plugins;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPOutputStream;

/**
 * NIP-55 Android Signer Plugin für Capacitor 8
 *
 * Kommuniziert mit Amber (com.greenart7c3.nostrsigner) und anderen
 * NIP-55 kompatiblen Signer-Apps via Intents und Content Resolver.
 *
 * ActivityCallback-Signatur in Capacitor 8:
 *   @ActivityCallback void name(PluginCall call, Intent data)
 *
 * NIP-55 Spec: https://github.com/nostr-protocol/nips/blob/master/55.md
 * Amber:       https://github.com/greenart7c3/Amber
 */
@CapacitorPlugin(name = "Nip55Signer")
public class Nip55SignerPlugin extends Plugin {

    private static final String TAG = "Nip55Signer";
    private static final String AMBER_PACKAGE = "com.greenart7c3.nostrsigner";

    // =========================================================================
    // Hilfsmethoden
    // =========================================================================

    private boolean isSignerInstalled() {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        PackageManager pm = getContext().getPackageManager();
        return !pm.queryIntentActivities(intent, 0).isEmpty();
    }

    private boolean isAmberInstalled() {
        try {
            getContext().getPackageManager().getPackageInfo(AMBER_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private String gzipCompress(String input) throws IOException {
        ByteArrayOutputStream byteStream = new ByteArrayOutputStream();
        GZIPOutputStream gzipStream = new GZIPOutputStream(byteStream);
        gzipStream.write(input.getBytes("UTF-8"));
        gzipStream.close();
        return Base64.encodeToString(byteStream.toByteArray(), Base64.NO_WRAP);
    }

    /**
     * Parst Intent-Extras in ein JSObject.
     */
    private JSObject parseIntentExtras(Intent data) {
        JSObject result = new JSObject();

        if (data == null || data.getExtras() == null) {
            result.put("rejected", false);
            return result;
        }

        Bundle extras = data.getExtras();
        result.put("rejected", extras.getBoolean("rejected", false));

        if (extras.containsKey("result")) result.put("result", extras.getString("result"));
        if (extras.containsKey("event")) result.put("event", extras.getString("event"));
        if (extras.containsKey("signature")) result.put("signature", extras.getString("signature"));
        if (extras.containsKey("package")) result.put("package", extras.getString("package"));
        if (extras.containsKey("id")) result.put("id", extras.getString("id"));

        Log.d(TAG, "Intent extras: rejected=" + result.getBool("rejected") +
              " hasResult=" + extras.containsKey("result") +
              " hasEvent=" + extras.containsKey("event"));

        return result;
    }

    // =========================================================================
    // Plugin-Methoden
    // =========================================================================

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean installed = isSignerInstalled();
        JSObject result = new JSObject();
        result.put("installed", installed);
        result.put("package", isAmberInstalled() ? AMBER_PACKAGE : null);
        result.put("amber", isAmberInstalled());
        Log.d(TAG, "isAvailable: installed=" + installed + " amber=" + isAmberInstalled());
        call.resolve(result);
    }

    // ── getPublicKey ─────────────────────────────────────────────────────────

    @PluginMethod
    public void getPublicKey(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("Kein NIP-55 Signer installiert.");
            return;
        }

        JSONArray permsArray = call.getArray("permissions");
        String permissions = permsArray != null ? permsArray.toString() : "";

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");
        if (!permissions.isEmpty()) {
            intent.putExtra("permissions", permissions);
        }

        Log.d(TAG, "getPublicKey intent...");
        startActivityForResult(call, intent, "getPublicKeyResult");
    }

    @ActivityCallback
    protected void getPublicKeyResult(PluginCall call, Intent data) {
        // Capacitor 8: data==null wenn resultCode != RESULT_OK → call wurde
        // bereits automatisch rejected, wir müssen nichts tun.
        if (data == null) return;

        JSObject extras = parseIntentExtras(data);

        if (extras.getBool("rejected")) {
            call.resolve(extras);
            return;
        }

        // pubkey kann in result, event oder pubkey stehen
        String pubkey = data.getExtras().getString("result", "");
        if (pubkey.isEmpty()) pubkey = data.getExtras().getString("pubkey", "");
        if (pubkey.isEmpty()) pubkey = data.getExtras().getString("event", "");

        extras.put("pubkey", pubkey);
        extras.put("package", data.getExtras().getString("package",
            getConfig().getString("signerPackage", AMBER_PACKAGE)));
        call.resolve(extras);
    }

    // ── signEvent ────────────────────────────────────────────────────────────

    @PluginMethod
    public void signEvent(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("Kein NIP-55 Signer installiert.");
            return;
        }

        try {
            JSObject event = call.getObject("event");
            String pubkey = call.getString("pubkey", "");
            String compressionType = call.getString("compressionType", "none");
            String returnType = call.getString("returnType", "signature");

            if (event == null) { call.reject("Missing event parameter"); return; }

            String eventJson = event.toString();

            StringBuilder uri = new StringBuilder("nostrsigner:");

            if ("gzip".equals(compressionType)) {
                uri.append("Signer1").append(gzipCompress(eventJson));
            } else {
                uri.append(Uri.encode(eventJson));
            }

            uri.append("?type=sign_event");
            uri.append("&compressionType=").append(compressionType);
            uri.append("&returnType=").append(returnType);
            if (!pubkey.isEmpty()) uri.append("&current_user=").append(pubkey);

            String requestId = call.getString("id", "");
            if (!requestId.isEmpty()) uri.append("&id=").append(requestId);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "signEvent: " + uri.toString().substring(0, Math.min(120, uri.length())));
            startActivityForResult(call, intent, "signEventResult");

        } catch (Exception e) {
            Log.e(TAG, "signEvent error: " + e.getMessage(), e);
            call.reject("Failed: " + e.getMessage());
        }
    }

    @ActivityCallback
    protected void signEventResult(PluginCall call, Intent data) {
        if (data == null) return;
        call.resolve(parseIntentExtras(data));
    }

    // ── nip44Encrypt ─────────────────────────────────────────────────────────

    @PluginMethod
    public void nip44Encrypt(PluginCall call) {
        if (!isSignerInstalled()) { call.reject("Kein NIP-55 Signer installiert."); return; }

        try {
            String plaintext = call.getString("plaintext", "");
            String pubkey = call.getString("pubkey", "");
            String currentUser = call.getString("currentUser", "");

            StringBuilder uri = new StringBuilder("nostrsigner:");
            uri.append(Uri.encode(plaintext));
            uri.append("?type=nip44_encrypt&pubkey=").append(pubkey);
            uri.append("&compressionType=none&returnType=signature");
            if (!currentUser.isEmpty()) uri.append("&current_user=").append(currentUser);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "nip44Encrypt");
            startActivityForResult(call, intent, "nip44EncryptResult");

        } catch (Exception e) {
            Log.e(TAG, "nip44Encrypt error: " + e.getMessage(), e);
            call.reject("Failed: " + e.getMessage());
        }
    }

    @ActivityCallback
    protected void nip44EncryptResult(PluginCall call, Intent data) {
        if (data == null) return;
        call.resolve(parseIntentExtras(data));
    }

    // ── nip44Decrypt ─────────────────────────────────────────────────────────

    @PluginMethod
    public void nip44Decrypt(PluginCall call) {
        if (!isSignerInstalled()) { call.reject("Kein NIP-55 Signer installiert."); return; }

        try {
            String ciphertext = call.getString("ciphertext", "");
            String pubkey = call.getString("pubkey", "");
            String currentUser = call.getString("currentUser", "");

            StringBuilder uri = new StringBuilder("nostrsigner:");
            uri.append(Uri.encode(ciphertext));
            uri.append("?type=nip44_decrypt&pubkey=").append(pubkey);
            uri.append("&compressionType=none&returnType=signature");
            if (!currentUser.isEmpty()) uri.append("&current_user=").append(currentUser);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "nip44Decrypt");
            startActivityForResult(call, intent, "nip44DecryptResult");

        } catch (Exception e) {
            Log.e(TAG, "nip44Decrypt error: " + e.getMessage(), e);
            call.reject("Failed: " + e.getMessage());
        }
    }

    @ActivityCallback
    protected void nip44DecryptResult(PluginCall call, Intent data) {
        if (data == null) return;
        call.resolve(parseIntentExtras(data));
    }

    // ── signEventInBackground (Content Resolver) ──────────────────────────────

    @PluginMethod
    public void signEventInBackground(PluginCall call) {
        try {
            JSObject event = call.getObject("event");
            String pubkey = call.getString("pubkey", "");

            if (event == null) { call.reject("Missing event parameter"); return; }

            String eventJson = event.toString();
            Uri contentUri = Uri.parse("content://" + AMBER_PACKAGE + ".SIGN_EVENT");
            String[] selectionArgs = new String[] { eventJson, "", pubkey };

            Cursor cursor = getContext().getContentResolver().query(
                contentUri, selectionArgs, null, null, null);

            if (cursor == null) {
                JSObject r = new JSObject();
                r.put("available", false);
                r.put("reason", "content_resolver_unavailable");
                call.resolve(r);
                return;
            }

            if (cursor.getColumnIndex("rejected") > -1) {
                cursor.close();
                JSObject r = new JSObject();
                r.put("rejected", true);
                call.resolve(r);
                return;
            }

            int resultIdx = cursor.getColumnIndex("result");
            int eventIdx = cursor.getColumnIndex("event");

            if (cursor.moveToFirst() && resultIdx > -1) {
                JSObject r = new JSObject();
                r.put("signature", cursor.getString(resultIdx));
                r.put("event", eventIdx > -1 ? cursor.getString(eventIdx) : null);
                r.put("available", true);
                cursor.close();
                call.resolve(r);
            } else {
                cursor.close();
                JSObject r = new JSObject();
                r.put("available", false);
                r.put("reason", "no_result");
                call.resolve(r);
            }

        } catch (Exception e) {
            Log.e(TAG, "signEventInBackground error: " + e.getMessage(), e);
            JSObject r = new JSObject();
            r.put("available", false);
            r.put("reason", e.getMessage());
            call.resolve(r);
        }
    }

    // ── openAmberInstall ─────────────────────────────────────────────────────

    @PluginMethod
    public void openAmberInstall(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://f-droid.org/packages/com.greenart7c3.nostrsigner/"));
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://github.com/greenart7c3/Amber/releases"));
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Browser konnte nicht geöffnet werden: " + e2.getMessage());
            }
        }
    }
}
