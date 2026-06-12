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
import com.getcapacitor.ActivityResult;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPOutputStream;

/**
 * NIP-55 Android Signer Plugin fur Capacitor 8
 *
 * Kommuniziert mit Amber (com.greenart7c3.nostrsigner) und anderen
 * NIP-55 kompatiblen Signer-Apps via Intents und Content Resolver.
 *
 * Verwendet die Capacitor-8-ActivityCallback-API fur Intent-Responses.
 *
 * NIP-55 Spec: https://github.com/nostr-protocol/nips/blob/master/55.md
 * Amber:       https://github.com/greenart7c3/Amber
 */
@CapacitorPlugin(name = "Nip55Signer")
public class Nip55SignerPlugin extends Plugin {

    private static final String TAG = "Nip55Signer";
    private static final String AMBER_PACKAGE = "com.greenart7c3.nostrsigner";
    private static final String SIGNER_SCHEME = "nostrsigner";

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
     * Baut das Ergebnis-Bundle des Signers in ein JSObject um.
     */
    private JSObject parseSignerResult(Bundle extras) {
        JSObject result = new JSObject();
        result.put("rejected", extras.getBoolean("rejected", false));

        if (extras.containsKey("result")) {
            result.put("result", extras.getString("result"));
        }
        if (extras.containsKey("event")) {
            result.put("event", extras.getString("event"));
        }
        if (extras.containsKey("signature")) {
            result.put("signature", extras.getString("signature"));
        }
        if (extras.containsKey("package")) {
            result.put("package", extras.getString("package"));
        }
        if (extras.containsKey("id")) {
            result.put("id", extras.getString("id"));
        }

        Log.d(TAG, "Signer response: rejected=" + extras.getBoolean("rejected", false) +
              ", hasResult=" + extras.containsKey("result") +
              ", hasEvent=" + extras.containsKey("event"));
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
        Log.d(TAG, "isAvailable: installed=" + installed + ", amber=" + isAmberInstalled());
        call.resolve(result);
    }

    @PluginMethod
    public void getPublicKey(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("Kein NIP-55 Signer installiert. Bitte Amber via F-Droid oder GitHub installieren.");
            return;
        }

        JSONArray permsArray = call.getArray("permissions");
        String permissions = permsArray != null ? permsArray.toString() : "";

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");
        if (!permissions.isEmpty()) {
            intent.putExtra("permissions", permissions);
        }

        Log.d(TAG, "Launching get_public_key intent via ActivityCallback...");
        startActivityForResult(call, intent, "getPublicKeyCallback");
    }

    /**
     * Callback fur getPublicKey – Capacitor 8 ActivityCallback API.
     */
    @ActivityCallback
    protected void getPublicKeyCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            Log.e(TAG, "getPublicKey: Activity result NOT OK: " + result.getResultCode());
            call.reject("Signer returned error code: " + result.getResultCode());
            return;
        }

        Intent data = result.getData();
        if (data == null || data.getExtras() == null) {
            call.reject("Keine Antwortdaten vom Signer erhalten.");
            return;
        }

        Bundle extras = data.getExtras();
        JSObject response = parseSignerResult(extras);

        if (extras.getBoolean("rejected", false)) {
            call.resolve(response);
            return;
        }

        // Der pubkey kommt in "result" ODER als "event" ODER extra "pubkey" zuruck
        String pubkey = extras.getString("result", "");
        if (pubkey.isEmpty()) {
            pubkey = extras.getString("pubkey", "");
        }
        // Manchmal kommt der pubkey auch als "event" wenn returnType=event
        if (pubkey.isEmpty()) {
            pubkey = extras.getString("event", "");
        }

        response.put("pubkey", pubkey);
        response.put("package", extras.getString("package",
            getConfig().getString("signerPackage", AMBER_PACKAGE)));
        call.resolve(response);
    }

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

            if (event == null) {
                call.reject("Missing event parameter");
                return;
            }

            String eventJson = event.toString();

            Log.d(TAG, "Signing event: kind=" + event.optInt("kind", -1) +
                  ", compressionType=" + compressionType);

            // BAUEN DES nostrsigner: URIs
            StringBuilder uriBuilder = new StringBuilder("nostrsigner:");

            if ("gzip".equals(compressionType)) {
                String compressed = gzipCompress(eventJson);
                uriBuilder.append("Signer1").append(compressed);
            } else {
                uriBuilder.append(Uri.encode(eventJson));
            }

            uriBuilder.append("?type=sign_event");
            uriBuilder.append("&compressionType=").append(compressionType);
            uriBuilder.append("&returnType=").append(returnType);

            if (!pubkey.isEmpty()) {
                uriBuilder.append("&current_user=").append(pubkey);
            }

            String requestId = call.getString("id", "");
            if (!requestId.isEmpty()) {
                uriBuilder.append("&id=").append(requestId);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse(uriBuilder.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "Launching sign_event intent: " +
                  uriBuilder.toString().substring(0, Math.min(120, uriBuilder.length())));

            startActivityForResult(call, intent, "signEventCallback");

        } catch (Exception e) {
            Log.e(TAG, "signEvent error: " + e.getMessage(), e);
            call.reject("Failed to sign event: " + e.getMessage());
        }
    }

    @ActivityCallback
    protected void signEventCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Signer returned error code: " + result.getResultCode());
            return;
        }

        Intent data = result.getData();
        if (data == null || data.getExtras() == null) {
            call.reject("Keine Antwortdaten vom Signer.");
            return;
        }

        JSObject response = parseSignerResult(data.getExtras());
        call.resolve(response);
    }

    @PluginMethod
    public void nip44Encrypt(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("Kein NIP-55 Signer installiert.");
            return;
        }

        try {
            String plaintext = call.getString("plaintext", "");
            String pubkey = call.getString("pubkey", "");
            String currentUser = call.getString("currentUser", "");

            StringBuilder uriBuilder = new StringBuilder("nostrsigner:");
            uriBuilder.append(Uri.encode(plaintext));
            uriBuilder.append("?type=nip44_encrypt");
            uriBuilder.append("&pubkey=").append(pubkey);
            uriBuilder.append("&compressionType=none");
            uriBuilder.append("&returnType=signature");
            if (!currentUser.isEmpty()) {
                uriBuilder.append("&current_user=").append(currentUser);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse(uriBuilder.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "Launching nip44_encrypt intent");
            startActivityForResult(call, intent, "nip44EncryptCallback");

        } catch (Exception e) {
            Log.e(TAG, "nip44Encrypt error: " + e.getMessage(), e);
            call.reject("Failed to encrypt: " + e.getMessage());
        }
    }

    @ActivityCallback
    protected void nip44EncryptCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Encrypt error code: " + result.getResultCode());
            return;
        }

        Intent data = result.getData();
        if (data == null || data.getExtras() == null) {
            call.reject("Keine Antwort vom Signer.");
            return;
        }

        JSObject response = parseSignerResult(data.getExtras());
        call.resolve(response);
    }

    @PluginMethod
    public void nip44Decrypt(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("Kein NIP-55 Signer installiert.");
            return;
        }

        try {
            String ciphertext = call.getString("ciphertext", "");
            String pubkey = call.getString("pubkey", "");
            String currentUser = call.getString("currentUser", "");

            StringBuilder uriBuilder = new StringBuilder("nostrsigner:");
            uriBuilder.append(Uri.encode(ciphertext));
            uriBuilder.append("?type=nip44_decrypt");
            uriBuilder.append("&pubkey=").append(pubkey);
            uriBuilder.append("&compressionType=none");
            uriBuilder.append("&returnType=signature");
            if (!currentUser.isEmpty()) {
                uriBuilder.append("&current_user=").append(currentUser);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse(uriBuilder.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "Launching nip44_decrypt intent");
            startActivityForResult(call, intent, "nip44DecryptCallback");

        } catch (Exception e) {
            Log.e(TAG, "nip44Decrypt error: " + e.getMessage(), e);
            call.reject("Failed to decrypt: " + e.getMessage());
        }
    }

    @ActivityCallback
    protected void nip44DecryptCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Decrypt error code: " + result.getResultCode());
            return;
        }

        Intent data = result.getData();
        if (data == null || data.getExtras() == null) {
            call.reject("Keine Antwort vom Signer.");
            return;
        }

        JSObject response = parseSignerResult(data.getExtras());
        call.resolve(response);
    }

    /**
     * Signiert ein Event im Hintergrund via Content Resolver.
     *
     * Funktioniert nur, wenn der User zuvor via Intent "remember my choice"
     * gewahlt hat.
     */
    @PluginMethod
    public void signEventInBackground(PluginCall call) {
        try {
            JSObject event = call.getObject("event");
            String pubkey = call.getString("pubkey", "");

            if (event == null) {
                call.reject("Missing event parameter");
                return;
            }

            String eventJson = event.toString();

            Uri contentUri = Uri.parse("content://" + AMBER_PACKAGE + ".SIGN_EVENT");
            String[] selectionArgs = new String[] { eventJson, "", pubkey };

            Cursor cursor = getContext().getContentResolver().query(
                contentUri, selectionArgs, null, null, null);

            if (cursor == null) {
                Log.d(TAG, "Content Resolver not available, use Intent fallback");
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("reason", "content_resolver_unavailable");
                call.resolve(result);
                return;
            }

            if (cursor.getColumnIndex("rejected") > -1) {
                Log.d(TAG, "Background signing permanently rejected by user");
                cursor.close();
                JSObject result = new JSObject();
                result.put("rejected", true);
                call.resolve(result);
                return;
            }

            int resultIdx = cursor.getColumnIndex("result");
            int eventIdx = cursor.getColumnIndex("event");

            if (cursor.moveToFirst() && resultIdx > -1) {
                JSObject result = new JSObject();
                result.put("signature", cursor.getString(resultIdx));
                result.put("event", eventIdx > -1 ? cursor.getString(eventIdx) : null);
                result.put("available", true);
                Log.d(TAG, "Background signing successful");
                cursor.close();
                call.resolve(result);
            } else {
                cursor.close();
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("reason", "no_result");
                call.resolve(result);
            }

        } catch (Exception e) {
            Log.e(TAG, "signEventInBackground error: " + e.getMessage(), e);
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("reason", e.getMessage());
            call.resolve(result);
        }
    }

    /**
     * Offnet die Amber-Installationsseite (F-Droid oder GitHub).
     */
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
                call.reject("Could not open browser: " + e2.getMessage());
            }
        }
    }
}
