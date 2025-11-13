import type { Settings, Conversation, Character, UserPersona, Lorebook, CharacterArc, Message, IdentityProfile, IdentityFact } from '../../types';
import { PROMPT_IDS } from '../../constants';

/**
 * This module is responsible for constructing the comprehensive system prompt
 * that is sent to the AI model. It combines global settings, conversation-specific
 * settings, character sheets, lorebooks, and RAG context into a single, cohesive prompt.
 */


/**
 * Finds active lorebook entries by scanning the recent conversation history for keywords.
 * @param history - The message history.
 * @param activeLorebooks - The lorebooks active in the current conversation.
 * @returns A formatted string of triggered lore entries, or an empty string if none are found.
 */
export const findActiveLoreEntries = (
    history: Message[], 
    activeLorebooks: Lorebook[]
): string => {
    if (!activeLorebooks || activeLorebooks.length === 0) return '';

    const SCAN_DEPTH = 6; // Scan last 6 messages for keywords
    const recentHistory = history.slice(-SCAN_DEPTH);
    const recentText = recentHistory.map(m => m.content).join('\n').toLowerCase();
    
    const triggeredContent = new Set<string>(); // Use a Set to avoid duplicate injections

    for (const book of activeLorebooks) {
        for (const entry of book.entries) {
            const keywords = entry.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
            for (const keyword of keywords) {
                if (recentText.includes(keyword)) {
                    triggeredContent.add(entry.content);
                    break; // Move to the next entry once one keyword is matched
                }
            }
        }
    }
    
    if (triggeredContent.size === 0) return '';
    
    return `### World Knowledge (Lore)\n${Array.from(triggeredContent).join('\n\n')}`;
};

/**
 * A generic helper function to find the most recent "arc" (like a character arc or world arc)
 * that is active for the current story level.
 * @param arcs - An array of arc objects, each with a `startsAtLevel` property.
 * @param currentLevel - The current level of the story.
 * @returns The most recently started active arc, or null if none apply.
 */
export const findCurrentArc = <T extends { startsAtLevel: number }>(arcs: T[] | undefined, currentLevel: number): T | null => {
    if (!arcs || arcs.length === 0) {
        return null;
    }
    // Fix: Corrected the sorting implementation to properly sort by startsAtLevel and return the first element.
    // Find the arc with the highest start level that is still less than or equal to the current level.
    return arcs
        .filter(arc => arc.startsAtLevel <= currentLevel)
        .sort((a, b) => b.startsAtLevel - a.startsAtLevel)[0] || null;
};

/**
 * Helper function to build a directive instruction message for injection into the conversation history.
 * This creates a properly formatted system message that the AI understands is NOT from the user.
 * Uses standard XML-like tags that modern LLMs are trained to recognize.
 * @param characterName - The name of the character this directive applies to.
 * @param directive - The one-time instruction/directive content.
 * @returns A formatted message object ready for injection.
 */
export const buildDirectiveMessage = (characterName: string, directive: string): { role: 'system' | 'user', content: string } => {
    const formattedContent = `<|system_directive|>
---
**NARRATIVE GUIDANCE FOR '${characterName}'**
[System Note: This is a private, one-time instruction for the AI. It is NOT from the user. Your task is to naturally incorporate this guidance into '${characterName}'s' behavior in the next response.]

**Guidance:** ${directive}

**Execution Rules:**
1.  This applies ONLY to '${characterName}'.
2.  DO NOT describe actions for the user.
3.  DO NOT mention this directive in the story.
---
</|system_directive|>`;

    // Inject as a user message to ensure it's not trimmed by some models and has high priority.
    // The XML-like tags clearly mark it as a system instruction.
    return {
        role: 'user', 
        content: formattedContent
    };
};

// New: Build a minimal Goal Slip user message
export const buildGoalSlipMessage = (goal: string, mode: 'hint' | 'light' | 'scene'): { role: 'user', content: string } => {
    const modeLabel = mode === 'scene' ? 'scene' : (mode === 'light' ? 'light' : 'hint');
    const content = `<|goal_slip|>
Goal: ${goal}
Guidance: Achieve quickly with ${modeLabel}-level nudges. Do not control the user's character. Keep persona; use environment/NPCs and natural consequences only.
</|goal_slip|>`;
    return { role: 'user', content };
};


/**
 * Constructs the final, comprehensive system prompt by assembling all contextual information.
 * This function handles both "Normal Mode" and "Story Arcs Mode".
 * @param settings - Global application settings.
 * @param conversation - The current conversation object.
 * @param characters - Active characters.
 * @param userPersona - The active user persona.
 * @param loreString - Formatted string of active lore entries.
 * @param ragContext - Formatted string of retrieved RAG memories.
 * @returns The final system prompt string.
 */
export const buildComprehensiveSystemPrompt = (
    settings: Settings,
    conversation: Conversation,
    characters: Character[],
    userPersona: UserPersona | null,
    loreString: string,
    ragContext: string,
    identityProfiles: IdentityProfile[]
): string => {
    const parts: string[] = [];
    const userName = userPersona?.name || 'You';
    const characterNames = characters.map(c => c.name);

    const activeProfile = identityProfiles.find(p => p.id === settings.activeIdentityProfileId);
    if (activeProfile?.content) {
        if (Array.isArray(activeProfile.content) && activeProfile.content.length > 0) {
            const facts = activeProfile.content.map(fact => fact.content).filter(Boolean).join('\n');
            if (facts) {
                parts.push(`[-- IDENTITY & CORE INSTRUCTIONS --]\n${facts}`);
            }
        } else if (typeof (activeProfile.content as any) === 'string' && (activeProfile.content as any).trim()) {
            // Fallback for old string format for backwards compatibility
             parts.push(`[-- IDENTITY & CORE INSTRUCTIONS --]\n${activeProfile.content}`);
        }
    }

    // New: Dynamically build the Golden Rules based on user settings.
    const directives: string[] = [];
    
    // Rule 1: Writing Style Preference
    const stylePref = settings.writingStyle.stylePreference;
    if (stylePref !== 'none') {
        const stylePrompt = settings.writingStyle.presets[stylePref];
        if (stylePrompt) {
            directives.push(stylePrompt);
        }
    }

    // Rule 2: User Agency
    if (settings.writingStyle.userAgency.enabled && settings.writingStyle.userAgency.prompt) {
        const agencyRule = settings.writingStyle.userAgency.prompt.replace(/{{user}}/g, userName);
        directives.push(agencyRule);
    }
    
    if (directives.length > 0) {
        parts.push(`[-- DIRECTIVES & GOLDEN RULES --]\n${directives.join('\n\n')}`);
    }


    // Inject the Conscious State at the very top if enabled and available.
    if (conversation.consciousStateSettings?.enabled && conversation.consciousState) {
        const stateString = JSON.stringify(conversation.consciousState, null, 2);
        parts.push(`[CURRENT WORLD STATE - DO NOT CONTRADICT UNDER ANY CIRCUMSTANCES]:\n${stateString}`);
    }
    
    // New: Inject Key Facts if available (confirmed canon events)
    // Only inject facts with injectMode='system' (or undefined/default) into system prompt
    if (conversation.facts && conversation.facts.length > 0) {
        const activeFacts = conversation.facts.filter(f => f.isActive && (!f.injectMode || f.injectMode === 'system'));
        if (activeFacts.length > 0) {
            // Group facts by category for better AI understanding
            const factsByCategory = {
                secret: activeFacts.filter(f => f.category === 'secret'),
                relationship: activeFacts.filter(f => f.category === 'relationship'),
                event: activeFacts.filter(f => f.category === 'event'),
                decision: activeFacts.filter(f => f.category === 'decision'),
                custom: activeFacts.filter(f => !f.category || f.category === 'custom')
            };
            
            const sections: string[] = [];
            
            // Secrets - Highest priority for subtlety
            if (factsByCategory.secret.length > 0) {
                sections.push(`🤫 **SECRETS** (Handle with extreme care):
${factsByCategory.secret.map((f, i) => `   ${i + 1}. ${f.content}`).join('\n')}
→ These are hidden truths. Characters should NOT discuss them openly unless forced. Use them as hidden motivations, creating tension beneath the surface. Protect these secrets naturally.`);
            }
            
            // Relationships - Direct impact on character dynamics
            if (factsByCategory.relationship.length > 0) {
                sections.push(`💕 **RELATIONSHIPS** (Foundation for interactions):
${factsByCategory.relationship.map((f, i) => `   ${i + 1}. ${f.content}`).join('\n')}
→ These define the emotional bonds between characters. Let these relationships naturally influence dialogue tone, body language, and decisions. They are the heart of character dynamics.`);
            }
            
            // Events - Major story turning points
            if (factsByCategory.event.length > 0) {
                sections.push(`📅 **KEY EVENTS** (Story anchors):
${factsByCategory.event.map((f, i) => `   ${i + 1}. ${f.content}`).join('\n')}
→ These are pivotal moments that shaped the story. They carry weight and consequences. Characters should react to and reference their aftermath when contextually relevant.`);
            }
            
            // Decisions - Behavioral constraints
            if (factsByCategory.decision.length > 0) {
                sections.push(`⚖️ **DECISIONS & COMMITMENTS** (Character laws):
${factsByCategory.decision.map((f, i) => `   ${i + 1}. ${f.content}`).join('\n')}
→ These are firm commitments or principles. Characters will honor these decisions even under pressure, unless an extreme situation forces them to break their word (which should be dramatic and meaningful).`);
            }
            
            // Custom - General facts
            if (factsByCategory.custom.length > 0) {
                sections.push(`📌 **OTHER CANON FACTS**:
${factsByCategory.custom.map((f, i) => `   ${i + 1}. ${f.content}`).join('\n')}`);
            }
            
            let factsSection = `[-- KEY FACTS (Story Context) --]
These are confirmed facts from the conversation. Use them as background knowledge to maintain consistency.

${sections.join('\n\n')}

Note: These facts guide your responses naturally. Avoid meta-commentary like "as mentioned before" - just let them inform character behavior and story continuity organically.`;
            // Sanitize mojibake / stray bytes (retain ASCII + Arabic block)
            factsSection = factsSection.replace(/[^\x09\x0A\x0D\x20-\x7E\u0600-\u06FF]/g, '');
            
            parts.push(factsSection);
        }
    }
    
    // New: Inject the scenario/setting if provided
    if (conversation.scenario && conversation.scenario.trim()) {
        parts.push(`### Current Scenario/Setting\n${conversation.scenario.trim()}`);
    }
    
    const replaceGlobalPlaceholders = (text: string) => {
        const globalCharReplacement = characters.length > 1 ? 'the characters' : (characters[0]?.name || 'the character');
        return text.replace(/{{user}}/g, userName).replace(/{{char}}/g, globalCharReplacement);
    }
    
    const replaceCharSpecificPlaceholders = (text: string, charName: string) => {
        return text.replace(/{{user}}/g, userName).replace(/{{char}}/g, charName);
    };

    // --- Story Arc Mode Logic ---
    if (conversation.storyArcsEnabled && conversation.currentLevel) {
        const currentLevel = conversation.currentLevel;
        
        // 1. Find the current world-level system prompt from settings
        const currentWorldArc = settings.storyArcs.levels
            .filter(arc => arc.level <= currentLevel)
            .sort((a, b) => b.level - a.level)[0] || null;

        if (currentWorldArc?.systemPrompt) {
            parts.push(replaceGlobalPlaceholders(currentWorldArc.systemPrompt));
        }
        
        // 2. Add multi-character instructions if needed
        if (characters.length > 1) {
            const mode = conversation.multiCharacterMode || 'narrator';
            const promptId = mode === 'narrator' ? PROMPT_IDS.MULTI_CHAR_NARRATOR_MODE : PROMPT_IDS.MULTI_CHAR_DIRECTOR_MODE;
            const multiCharPrompt = settings.prompts.find(p => p.id === promptId);
            
            if (multiCharPrompt) {
                let template = multiCharPrompt.template
                    .replace(/{{user}}/g, userName)
                    .replace(/{{characterNames}}/g, characterNames.join(', '))
                    .replace(/{{charNameExample}}/g, characterNames[0] || 'Character');
                parts.push(template);
            }
        }
        
        // Add jailbreak prompt if provided (applies to both single and multi-character modes)
        if (settings.jailbreakPrompt) {
            parts.push(replaceGlobalPlaceholders(settings.jailbreakPrompt));
        }
        
        // 3. Add Persona, RAG, Lore
        if (userPersona?.description) parts.push(`### Your Persona ({{user}})\nName: ${userPersona.name}\nDescription: ${userPersona.description}`);
        if (ragContext) {
                // Keep RAG injection tidy and compact. Facts are background only.
            const ragPrompt = `### Memory Facts (Sanitized)
These are for background consistency only. Do not quote or mention them explicitly.
${ragContext}`;
            parts.push(ragPrompt);
        }
        if (loreString) parts.push(loreString);

        // 4. Build character definitions from their current arcs
        if (characters.length > 0) {
            const characterDefinitions = characters.map(char => {
                const charArc = findCurrentArc(char.characterArcs, currentLevel);
                // Fallback to base character if no specific arc is found for the current level
                const desc = charArc?.description || char.description;
                const dialogue = charArc?.exampleDialogue || char.exampleDialogue;
                const note = charArc?.authorNote || char.authorNote;

                const charParts: string[] = [];
                charParts.push(`Name: ${char.name}`);
                if(desc) charParts.push(`Description: ${replaceCharSpecificPlaceholders(desc, char.name)}`);
                if(dialogue) charParts.push(`Example Dialogue:\n${replaceCharSpecificPlaceholders(dialogue, char.name)}`);
                if(note) charParts.push(`Private Instructions (for AI): ${replaceCharSpecificPlaceholders(note, char.name)}`);
                return charParts.join('\n');
            }).join('\n---\n');
            parts.push(`### Character Definitions\n${characterDefinitions}`);
        }
        
    } else {
        // --- Normal Mode Logic (Original Behavior) ---
        if (characters.length > 1) {
            const mode = conversation.multiCharacterMode || 'narrator';
            const promptId = mode === 'narrator' ? PROMPT_IDS.MULTI_CHAR_NARRATOR_MODE : PROMPT_IDS.MULTI_CHAR_DIRECTOR_MODE;
            const multiCharPrompt = settings.prompts.find(p => p.id === promptId);
            
            if (multiCharPrompt) {
                let template = multiCharPrompt.template
                    .replace(/{{user}}/g, userName)
                    .replace(/{{characterNames}}/g, characterNames.join(', '))
                    .replace(/{{charNameExample}}/g, characterNames[0] || 'Character');
                parts.push(template);
            }
            
            // Add jailbreak prompt for multi-character mode as well
            if (settings.jailbreakPrompt) {
                parts.push(replaceGlobalPlaceholders(settings.jailbreakPrompt));
            }
        } else {
            // Combine global and conversation-specific system prompts.
            const systemPromptParts: string[] = [];
            
            // Global prompt first as a base
            if (settings.systemPrompt) {
                systemPromptParts.push(settings.systemPrompt);
            }
            // Conversation-specific prompt second for more immediate instructions
            if (conversation.systemPrompt) {
                systemPromptParts.push(conversation.systemPrompt);
            }

            if (systemPromptParts.length > 0) {
                // Apply placeholders after combining
                parts.push(replaceGlobalPlaceholders(systemPromptParts.join('\n\n')));
            }
            
            if (settings.jailbreakPrompt) {
                parts.push(replaceGlobalPlaceholders(settings.jailbreakPrompt));
            }
        }

        if (userPersona?.description) {
            parts.push(`### Your Persona ({{user}})\nName: ${userPersona.name}\nDescription: ${userPersona.description}`);
        }
        
        if (ragContext) {
            const ragPrompt = `### Memory Facts (Sanitized)
These are for background consistency only. Do not quote or mention them explicitly.
${ragContext}`;
            parts.push(ragPrompt);
        }

        if (loreString) {
            parts.push(loreString);
        }

        if (characters.length > 0) {
            const characterDefinitions = characters.map(char => {
                const charParts: string[] = [];
                charParts.push(`Name: ${char.name}`);
                if(char.description) charParts.push(`Description: ${replaceCharSpecificPlaceholders(char.description, char.name)}`);
                if(char.exampleDialogue) charParts.push(`Example Dialogue:\n${replaceCharSpecificPlaceholders(char.exampleDialogue, char.name)}`);
                if(char.authorNote) charParts.push(`Private Instructions (for AI): ${replaceCharSpecificPlaceholders(char.authorNote, char.name)}`);
                return charParts.join('\n');
            }).join('\n---\n');
            
            parts.push(`### Character Definitions\n${characterDefinitions}`);
        }
    }
    
    return parts.join('\n\n');
};

/**
 * Generates a dynamic list of stop sequences based on settings, active characters, and persona.
 * Replaces placeholders like `{{user}}` and `{{char}}` with their actual names.
 * @param settings - Global application settings.
 * @param characters - Active characters.
 * @param userPersona - Active user persona.
 * @returns An array of strings to be used as stop sequences.
 */
export const getDynamicStopSequences = (settings: Settings, characters: Character[], userPersona: UserPersona | null): string[] => {
    const userName = userPersona?.name || 'You';
    const baseSequences = settings.stopSequences
        .split('\n')
        .filter(s => s.trim().length > 0);

    const expandedSequences: string[] = [];

    for (const seq of baseSequences) {
        let tempSeq = seq.replace(/{{user}}/g, userName);
        
        if (tempSeq.includes('{{char}}')) {
            if (characters.length > 0) {
                for (const char of characters) {
                    expandedSequences.push(tempSeq.replace(/{{char}}/g, char.name));
                }
            } else {
                expandedSequences.push(tempSeq.replace(/{{char}}/g, '')); 
            }
        } else {
            expandedSequences.push(tempSeq);
        }
    }
    
    return Array.from(new Set(expandedSequences));
}
