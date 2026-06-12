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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPOutputStream;

/**
 * NIP-55 Android Signer Plugin für Capacitor
 *
 * Kommuniziert mit Amber (com.greenart7c3.nostrsigner) und anderen
 * NIP-55 kompatiblen Signer-Apps via Intents und Content Resolver.
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

    /**
     * Prüft ob Amber oder ein anderer NIP-55 Signer installiert ist.
     */
    private boolean isSignerInstalled() {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        PackageManager pm = getContext().getPackageManager();
        return !pm.queryIntentActivities(intent, 0).isEmpty();
    }

    /**
     * Prüft ob das spezifische Amber-Package installiert ist.
     */
    private boolean isAmberInstalled() {
        try {
            getContext().getPackageManager().getPackageInfo(AMBER_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /**
     * Gzip-komprimieren für große Events (NIP-55 compressionType=gzip).
     * Gibt Base64 des gzip-komprimierten JSON zurück.
     */
    private String gzipCompress(String input) throws IOException {
        ByteArrayOutputStream byteStream = new ByteArrayOutputStream();
        GZIPOutputStream gzipStream = new GZIPOutputStream(byteStream);
        gzipStream.write(input.getBytes("UTF-8"));
        gzipStream.close();
        return Base64.encodeToString(byteStream.toByteArray(), Base64.NO_WRAP);
    }

    // =========================================================================
    // Plugin-Methoden (via Capacitor Bridge aufrufbar)
    // =========================================================================

    /**
     * Prüft ob ein NIP-55 Signer verfügbar ist.
     *
     * JS-Aufruf: Nip55Signer.isAvailable()
     * Rückgabe:  { installed: boolean, package: string|null }
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean installed = isSignerInstalled();
        String pkg = isAmberInstalled() ? AMBER_PACKAGE : null;

        JSObject result = new JSObject();
        result.put("installed", installed);
        result.put("package", pkg);
        result.put("amber", isAmberInstalled());

        Log.d(TAG, "isAvailable: installed=" + installed + ", amber=" + isAmberInstalled());
        call.resolve(result);
    }

    /**
     * Holt den Public Key vom Signer via Intent.
     *
     * JS-Aufruf: Nip55Signer.getPublicKey({ permissions: [...] })
     * Rückgabe:  { pubkey: string, package: string }
     */
    @PluginMethod
    public void getPublicKey(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("No NIP-55 signer installed. Please install Amber from F-Droid or GitHub.");
            return;
        }

        // Permissions die der User vorab authorisieren kann (optional)
        JSONArray permsArray = call.getArray("permissions");
        String permissions = permsArray != null ? permsArray.toString() : "";

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");

        if (!permissions.isEmpty()) {
            intent.putExtra("permissions", permissions);
        }

        Log.d(TAG, "Launching get_public_key intent...");

        // Nutze startActivityForResult für die Antwort
        startActivityForResult(call, intent, "amberGetPublicKey");
    }

    /**
     * Signiert ein Nostr-Event via NIP-55 Signer.
     *
     * JS-Aufruf: Nip55Signer.signEvent({
     *   event: { kind, content, tags, created_at },
     *   pubkey: "...",
     *   compressionType: "none" | "gzip"
     * })
     * Rückgabe:  { signature: string, event: string }
     */
    @PluginMethod
    public void signEvent(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("No NIP-55 signer installed.");
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
                // NIP-55 gzip-Format: "Signer1" + Base64(gzip(json))
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

            // Zusätzlich: ID für korrekte Zuordnung
            String requestId = call.getString("id", "");
            if (!requestId.isEmpty()) {
                uriBuilder.append("&id=").append(requestId);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriBuilder.toString()));
            intent.setPackage(AMBER_PACKAGE); // Gezielt Amber ansteuern

            Log.d(TAG, "Launching sign_event intent: " + uriBuilder.toString().substring(0, Math.min(120, uriBuilder.length())));

            startActivityForResult(call, intent, "amberSignEvent");

        } catch (Exception e) {
            Log.e(TAG, "signEvent error: " + e.getMessage(), e);
            call.reject("Failed to sign event: " + e.getMessage());
        }
    }

    /**
     * NIP-44 Verschlüsselung via Signer.
     *
     * JS-Aufruf: Nip55Signer.nip44Encrypt({
     *   plaintext: "...",
     *   pubkey: "...",
     *   currentUser: "..."
     * })
     * Rückgabe:  { result: string }
     */
    @PluginMethod
    public void nip44Encrypt(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("No NIP-55 signer installed.");
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

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriBuilder.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "Launching nip44_encrypt intent");
            startActivityForResult(call, intent, "amberNip44Encrypt");

        } catch (Exception e) {
            Log.e(TAG, "nip44Encrypt error: " + e.getMessage(), e);
            call.reject("Failed to encrypt: " + e.getMessage());
        }
    }

    /**
     * NIP-44 Entschlüsselung via Signer.
     */
    @PluginMethod
    public void nip44Decrypt(PluginCall call) {
        if (!isSignerInstalled()) {
            call.reject("No NIP-55 signer installed.");
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

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriBuilder.toString()));
            intent.setPackage(AMBER_PACKAGE);

            Log.d(TAG, "Launching nip44_decrypt intent");
            startActivityForResult(call, intent, "amberNip44Decrypt");

        } catch (Exception e) {
            Log.e(TAG, "nip44Decrypt error: " + e.getMessage(), e);
            call.reject("Failed to decrypt: " + e.getMessage());
        }
    }

    /**
     * Signiert ein Event via Content Resolver (Background).
     *
     * Funktioniert nur, wenn der User zuvor via Intent "remember my choice"
     * für diese Permission gewählt hat.
     *
     * JS-Aufruf: Nip55Signer.signEventInBackground({
     *   event: { ... },
     *   pubkey: "..."
     * })
     * Rückgabe: { signature: string, event: string } oder null wenn abgelehnt
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

            // Content Resolver Query an Amber
            Uri contentUri = Uri.parse("content://" + AMBER_PACKAGE + ".SIGN_EVENT");
            String[] selectionArgs = new String[] { eventJson, "", pubkey };

            Cursor cursor = getContext().getContentResolver().query(
                contentUri,
                selectionArgs,
                null, null, null
            );

            if (cursor == null) {
                // Content Resolver nicht verfügbar – Fallback zu Intent
                Log.d(TAG, "Content Resolver unavailable, reject (use Intent fallback)");
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
                String signature = cursor.getString(resultIdx);
                String signedEvent = eventIdx > -1 ? cursor.getString(eventIdx) : null;

                JSObject result = new JSObject();
                result.put("signature", signature);
                result.put("event", signedEvent);
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
     * Öffnet den Amber Play Store / F-Droid / GitHub Link.
     *
     * JS-Aufruf: Nip55Signer.openAmberInstall()
     */
    @PluginMethod
    public void openAmberInstall(PluginCall call) {
        try {
            // Versuche zuerst F-Droid zu öffnen
            Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://f-droid.org/packages/com.greenart7c3.nostrsigner/"));
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Fallback: GitHub Releases
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

    // =========================================================================
    // Activity-Result Handling (Antwort vom Signer-Intent)
    // =========================================================================

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        PluginCall savedCall = getSavedCall();

        if (savedCall == null) {
            Log.w(TAG, "No saved call for activity result");
            return;
        }

        if (resultCode != Activity.RESULT_OK) {
            Log.e(TAG, "Activity result NOT OK: " + resultCode);
            savedCall.reject("Signer returned error code: " + resultCode);
            return;
        }

        if (data == null) {
            savedCall.reject("No data returned from signer");
            return;
        }

        Bundle extras = data.getExtras();
        if (extras == null) {
            savedCall.reject("No extras in signer response");
            return;
        }

        // Prüfe auf Ablehnung
        if (extras.getBoolean("rejected", false)) {
            Log.d(TAG, "User rejected the signing request");
            JSObject result = new JSObject();
            result.put("rejected", true);
            savedCall.resolve(result);
            return;
        }

        // Extrahiere Ergebnisse
        JSObject result = new JSObject();
        result.put("rejected", false);

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

        Log.d(TAG, "Signer response: rejected=false, hasResult=" +
              extras.containsKey("result"));

        savedCall.resolve(result);
    }
}
