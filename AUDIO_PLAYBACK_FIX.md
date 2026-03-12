# Audio Playback Fix

## Issue
AI-generated audio content was not playing because:

1. **Placeholder URLs**: The backend was generating placeholder URLs (e.g., `#audio-placeholder-123456`) instead of actual audio files
2. **No Audio Player**: The UI had a "Play" button but no actual HTML5 audio element or playback functionality
3. **No Event Handlers**: The Play button had no onClick handler to trigger audio playback

## Solution Implemented

### Frontend Changes (`client/src/components/course/content-block.tsx`)

1. **Added Audio State Management**:
   - Added `audioRef` to reference the HTML5 audio element
   - Added `audioState` to track playback status (isPlaying, currentTime, duration)

2. **Implemented Playback Controls**:
   - `handlePlayPause()`: Toggles between play and pause
   - `handleAudioTimeUpdate()`: Updates current time and duration
   - `handleAudioEnded()`: Resets state when audio finishes

3. **Enhanced UI Components**:
   - For both `audio` and `ai-audio` content blocks:
     - Added interactive Play/Pause button with icons
     - Added HTML5 `<audio>` element with controls
     - Shows helpful message when URL is a placeholder
     - Disables play button when no valid audio URL exists

4. **User Experience**:
   - Button shows Play icon when stopped, Pause icon when playing
   - Native HTML5 audio controls for seek, volume, etc.
   - Clear feedback when audio URL is invalid or placeholder

## Current State

✅ **Audio playback UI is now functional** - Users can play audio IF they provide a valid audio URL

⚠️ **Audio generation still uses placeholders** - The backend currently generates:
- Audio scripts (text content) ✅
- Placeholder URLs like `#audio-placeholder-${timestamp}` ⚠️

## To Enable Full Audio Generation

To get actual playable audio from AI-generated scripts, you need to integrate a Text-to-Speech (TTS) service:

### Option 1: Google Cloud Text-to-Speech (Recommended)
```typescript
// server/ai-service.ts or routes.ts
import textToSpeech from '@google-cloud/text-to-speech';

async function generateAudioFromScript(script: string, voice?: string): Promise<string> {
  const client = new textToSpeech.TextToSpeechClient();
  
  const request = {
    input: { text: script },
    voice: { 
      languageCode: 'en-US', 
      name: voice || 'en-US-Neural2-C' 
    },
    audioConfig: { audioEncoding: 'MP3' }
  };
  
  const [response] = await client.synthesizeSpeech(request);
  
  // Save audio to file system or cloud storage
  const audioPath = `/audio/${Date.now()}.mp3`;
  fs.writeFileSync(`./public${audioPath}`, response.audioContent, 'binary');
  
  return audioPath; // Return the actual URL
}
```

### Option 2: Amazon Polly
```typescript
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

async function generateAudioFromScript(script: string): Promise<string> {
  const client = new PollyClient({ region: "us-east-1" });
  
  const command = new SynthesizeSpeechCommand({
    Text: script,
    OutputFormat: "mp3",
    VoiceId: "Joanna"
  });
  
  const response = await client.send(command);
  // Save and return audio URL
  // ...
}
```

### Option 3: ElevenLabs (High Quality)
```typescript
async function generateAudioFromScript(script: string): Promise<string> {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_monolingual_v1"
    })
  });
  
  // Save audio and return URL
  // ...
}
```

### Integration Point

Update `server/routes.ts` at line 1075-1088:

```typescript
// Generate audio script
const result = await generateText(requestData, courseContext);

// NEW: Convert script to actual audio
const audioUrl = await generateAudioFromScript(result.text);

res.json({
  script: result.text,
  audioUrl: audioUrl, // Real URL instead of placeholder
  duration: "2:30", // Calculate actual duration
  provider: result.provider,
  model: result.model
});
```

## Cost Considerations

- **Google Cloud TTS**: ~$4 per 1 million characters
- **Amazon Polly**: ~$4 per 1 million characters  
- **ElevenLabs**: Subscription-based, higher quality voices
- **Local TTS (pyttsx3, espeak)**: Free but lower quality

## Testing

To test with a real audio file right now:

1. Edit an audio block
2. Enter a valid audio URL (e.g., from a hosted MP3 file)
3. Click the Play button - audio should now play!

Example test URLs:
- `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`
- Any publicly accessible audio file URL
