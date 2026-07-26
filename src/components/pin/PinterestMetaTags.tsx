/**
 * Pinterest Promotion API
 * 
 * Endpoints:
 * POST /api/promotion/generate-pin-text -> KI-generierte
 * GET /api/promotion/articles -> Artikel-Liste
 * POST /api/promotion/save-pin -> speichern
 * 
 * Verwendet die zentrale KI-Modell-Verwaltung:
 * Text-Modelle: mini / medium / maxi (aktuell alle Claude Sonnet 5)
 * Vision-Modell: Qwen 2.5 VL 72B
 */

export default {
    app.post('/api/promotion/generate-pin-text', async (req, res) => {
        if (!validateApiKey()) {
            return res.status(500).json({ error: 'Server-Konfigurationsfehler: API-Key fehlt' });
        }

        const title = sanitizeInput(req.body.title) || '';
        const template = sanitizeInput(req.body.template) || 'infographic';
        const model = sanitizeInput(req.body.model) || 'medium';
        const lifestyle = sanitizeInput(req.body.lifestyle) || 'perpetual-travelers';

        const templateConfig = TEMPLATES[template];
        if (!templateConfig) {
            return res.status(400).json({ error: `Unbekanntes Template: ${template}` });
        }

        console.log(`[Promotion] Generiere Pin-Text: Template=${template}, Modell=${model}, Titel="${title}"`);

        const systemPrompt = `Du bist ein Pinterest-SEO-Experte für Reise- und Vanlife-Blogs. Du erstellst optimierte
            Pins die viral gehen und Klicks generieren. Antworte IMMER NUR mit validem JSON. Keinerlei Erklärungen
            außerhalb des JSON. Keine Markdown-Code-Blöcke. Keine zusätzlichen Kommentare.`;

        const prompt = templateConfig.prompt({ title, summary: '', text: '' });

        try {
            const result = await generateWithKi(prompt, systemPrompt, model, 600, 0.8);
            const pinData = parsePinJson(result);

            if (!pinData) {
                console.error('[Promotion] KI hat kein valides JSON zurückgegeben:', result.substring(0, 200));
                return res.status(502).json({
                    error: 'KI gab kein gültiges JSON zurück',
                    rawText: result.substring(0, 500)
                });
            }

            console.log('[Promotion] Pin-Text erfolgreich generiert:', JSON.stringify(pinData).substring(0, 100));

            res.json({
                success: true,
                pinData: {
                    template,
                    model: model || 'medium',
                ...pinData
                }
            });
        } catch (error) {
            console.error('[Promotion] Fehler bei Pin-Text Generierung:', error.response?.data || error.message);

            if (error.response?.status === 429) {
                res.status(429).json({ error: 'API-Limit erreicht. Bitte warte einen Moment.' });
            } else if (error.response?.status === 400) {
                res.status(400).json({ error: 'Ungültige Anfrage. Prüfe deine Eingaben.' });
            } else if (error.code === 'ECONNABORTED') {
                res.status(408).json({ error: 'Zeitüberschreitung. Versuche es erneut.' });
            } else {
                res.status(500).json({ error: 'Fehler bei Pin-Text Generierung. Versuche es erneut.' });
            }
        }
    });
}
