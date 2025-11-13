import { useState, useCallback, useRef, useEffect } from 'react';
import type { Story, Settings, Model } from '../types';
import { streamChatResponse, rewriteStorySelection } from '../services/aiService';
import { saveStory } from '../services/db';
import { generateUUID } from '../utils/uuid';
import { useNotifications } from '../contexts/NotificationContext';

interface StoryHandlerProps {
  story: Story | null;
  onStoryUpdate: (updatedStory: Story) => void;
  settings: Settings;
  selectedModel: Model;
}

export const useStoryHandler = (props: StoryHandlerProps) => {
  const { story, onStoryUpdate, settings, selectedModel } = props;

  const [isStreaming, setIsStreaming] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storyRef = useRef(story);
  const { addNotification } = useNotifications();

  useEffect(() => {
    storyRef.current = story;
  }, [story]);

  const handleGenerate = useCallback(async (userGuidance?: string) => {
    if (!story || isStreaming || isRewriting) return;

    setError(null);
    setIsStreaming(true);

    const continuationInstruction = userGuidance || "Continue the story from where it left off, writing the next logical part.";
    const history = [
        { id: generateUUID(), role: 'user' as const, content: story.content + '\n\n---\n\n' + continuationInstruction, timestamp: Date.now() }
    ];
    
    const dummyConversation = {
        id: story.id,
        title: story.title,
        messages: [],
        createdAt: story.createdAt,
        systemPrompt: story.systemPrompt,
        characterIds: [],
        lorebookIds: []
    };

    let generatedChunk = '';
    const initialContent = story.content;
    const separator = initialContent.length > 0 && !initialContent.endsWith('\n\n') ? '\n\n' : '';

    onStoryUpdate({ ...story, content: initialContent + separator });

    await streamChatResponse(
      dummyConversation,
      history,
      selectedModel,
      settings,
      [], [], null, [],
      (chunk) => {
        const currentStory = storyRef.current;
        if (currentStory) {
            generatedChunk += chunk;
            onStoryUpdate({ ...currentStory, content: initialContent + separator + generatedChunk });
        }
      },
      (err) => {
        setError(`Error from AI: ${err.message}`);
        setIsStreaming(false);
        const currentStory = storyRef.current;
        if (currentStory) {
            onStoryUpdate({ ...currentStory, content: initialContent });
        }
      },
      async (totalTokens, fullResponseText, modelMessage) => {
        setIsStreaming(false);
        const latestStory = storyRef.current;
        if (latestStory) {
          await saveStory(latestStory);
        }
      },
      new AbortController().signal,
      // FIX: Add the missing onStatusUpdate argument to match the function's signature.
      () => {}
    );
  }, [story, isStreaming, isRewriting, settings, selectedModel, onStoryUpdate]);
  
  const handleRewriteSelection = useCallback(async (selection: string, rewritePrompt: string) => {
    const currentStory = storyRef.current;
    if (!currentStory || isStreaming || isRewriting) return;

    setIsRewriting(true);
    setError(null);
    
    const originalContent = currentStory.content;
    const startIndex = originalContent.indexOf(selection);
    if (startIndex === -1) {
        setError("Could not find the selected text in the story to rewrite.");
        setIsRewriting(false);
        return;
    }

    let rewrittenChunk = '';
    
    try {
        await rewriteStorySelection(
            originalContent,
            selection,
            rewritePrompt,
            currentStory.systemPrompt,
            selectedModel,
            settings,
            (chunk) => {
                rewrittenChunk += chunk;
                const newContent = originalContent.substring(0, startIndex) + rewrittenChunk + originalContent.substring(startIndex + selection.length);
                const storyToUpdate = storyRef.current;
                if(storyToUpdate) {
                    onStoryUpdate({ ...storyToUpdate, content: newContent });
                }
            }
        );
    } catch (err: any) {
        setError(`Rewrite failed: ${err.message}`);
        // Revert to original content on error
        onStoryUpdate({ ...currentStory, content: originalContent });
    } finally {
        setIsRewriting(false);
        const latestStory = storyRef.current;
        if (latestStory) {
            await saveStory(latestStory);
        }
    }
}, [isStreaming, isRewriting, onStoryUpdate, settings, selectedModel]);


  const handleContentChange = (newContent: string) => {
    if (story) {
        const updatedStory = { ...story, content: newContent };
        onStoryUpdate(updatedStory);
    }
  };
  
  const handleSystemPromptChange = (newPrompt: string) => {
      if (story) {
          onStoryUpdate({ ...story, systemPrompt: newPrompt });
      }
  };

  const handleSave = async () => {
    if (story) {
        await saveStory(story);
        addNotification({
            title: 'Story Saved',
            message: `"${story.title}" has been saved.`,
            type: 'success',
            duration: 3000
        });
    }
  };

  return {
    isStreaming,
    isRewriting,
    error,
    handleGenerate,
    handleContentChange,
    handleSystemPromptChange,
    handleSave,
    handleRewriteSelection,
  };
};