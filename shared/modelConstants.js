/**
 * Centralized Model Definitions
 * Single source of truth for all supported AI models
 */

/**
 * Centralized Model Definitions
 * Single source of truth for all supported AI models
 *
 * Last updated: 2026-04-04
 *
 * ──────────────────────────────────────────────────────────
 * DYNAMIC MODEL DISCOVERY (per-CLI capabilities)
 * ──────────────────────────────────────────────────────────
 *
 * Claude Code:
 *   - No CLI command yet to list models non-interactively.
 *     /model inside a session shows the picker but requires an active session.
 *     Feature request: https://github.com/anthropics/claude-code/issues/12612
 *   - Anthropic Models API (REST):
 *       curl https://api.anthropic.com/v1/models \
 *         -H 'anthropic-version: 2023-06-01' \
 *         -H "X-Api-Key: $ANTHROPIC_API_KEY"
 *     Returns every available model with id, display_name, and capabilities.
 *     This is the best source for automated updates.
 *
 * Gemini CLI:
 *   - /model inside a session shows Auto (Pro/Flash) and Manual picker.
 *   - --model <name> flag at startup selects a model.
 *   - No non-interactive "list models" subcommand in the official Google CLI.
 *   - Google AI Gemini API (REST):
 *       curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY"
 *     Returns all available Gemini models with name, displayName, and
 *     supportedGenerationMethods.
 *
 * OpenAI Codex CLI:
 *   - /model inside a session shows a picker.
 *   - codex --model <name> or -m <name> at startup selects a model.
 *   - No dedicated "list models" subcommand.
 *   - OpenAI Models API (REST):
 *       curl https://api.openai.com/v1/models \
 *         -H "Authorization: Bearer $OPENAI_API_KEY"
 *     Returns all models; filter by id prefix for codex-relevant ones.
 *
 * Cursor CLI:
 *   - /models inside a session lists available models.
 *   - cursor agent models or --list-models flag lists models non-interactively.
 *   - No public REST API for model enumeration; models are managed by
 *     Cursor's backend and must remain a static list here.
 *
 * RECOMMENDATION: Build a server-side cron or startup job that calls the
 * Anthropic, Google, and OpenAI REST APIs to discover models, then merges
 * results with the static lists below.  Cursor models must remain static
 * since there is no public API for enumeration.
 * ──────────────────────────────────────────────────────────
 */

/**
 * Claude (Anthropic) Models
 *
 * Note: Claude Code uses two different formats:
 * - SDK format ('sonnet', 'opus') - used by the UI and claude-sdk.js
 * - API format ('claude-sonnet-4-6') - used by slash commands for display
 */
export const CLAUDE_MODELS = {
  // Models in SDK format (what the actual SDK accepts)
  OPTIONS: [
    { value: "sonnet", label: "Sonnet (4.6)" },
    { value: "opus", label: "Opus (4.6)" },
    { value: "haiku", label: "Haiku (4.5)" },
    { value: "opusplan", label: "Opus Plan (Opus→plan, Sonnet→execute)" },
    { value: "sonnet[1m]", label: "Sonnet [1M Context]" },
    { value: "opus[1m]", label: "Opus [1M Context]" },
    { value: "sonnet5", label: "Sonnet 5 (Fennec)" },
  ],

  DEFAULT: "sonnet",
};

/**
 * Cursor Models
 *
 * Cursor supports models from Anthropic, OpenAI, Google, xAI, and its
 * own proprietary Composer model.  Switchable per-session via /models.
 */
export const CURSOR_MODELS = {
  OPTIONS: [
    // --- Anthropic ---
    { value: "sonnet-4.6", label: "Claude 4.6 Sonnet" },
    { value: "sonnet-4.6-thinking", label: "Claude 4.6 Sonnet (Thinking)" },
    { value: "opus-4.6", label: "Claude 4.6 Opus" },
    { value: "opus-4.6-thinking", label: "Claude 4.6 Opus (Thinking)" },
    { value: "sonnet-4.5", label: "Claude 4.5 Sonnet" },
    { value: "sonnet-4.5-thinking", label: "Claude 4.5 Sonnet (Thinking)" },
    { value: "opus-4.5", label: "Claude 4.5 Opus" },
    { value: "opus-4.5-thinking", label: "Claude 4.5 Opus (Thinking)" },

    // --- OpenAI ---
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.2-high", label: "GPT-5.2 High" },

    // --- Google ---
    { value: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
    { value: "gemini-3-pro", label: "Gemini 3 Pro" },

    // --- Cursor Proprietary ---
    { value: "composer-1", label: "Composer 1" },
    { value: "auto", label: "Auto" },

    // --- xAI ---
    { value: "grok-code", label: "Grok Code" },
  ],

  DEFAULT: "auto",
};

/**
 * Codex (OpenAI) Models
 *
 * Canonical model list from:
 *   https://developers.openai.com/codex/models
 */
export const CODEX_MODELS = {
  OPTIONS: [
    { value: "gpt-5.4", label: "GPT-5.4 (Recommended)" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini (Fast / Sub-agents)" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark (Research Preview)" },
    { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
    { value: "gpt-5.2", label: "GPT-5.2" },
  ],

  DEFAULT: "gpt-5.4",
};

/**
 * Gemini Models
 *
 * Official model list from:
 *   https://ai.google.dev/gemini-api/docs/models
 *
 * Note: gemini-3-pro-preview was deprecated and shut down on 2026-03-09.
 *       Migrate to gemini-3.1-pro-preview.
 */
export const GEMINI_MODELS = {
  OPTIONS: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview (Latest)" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],

  DEFAULT: "gemini-2.5-flash",
};