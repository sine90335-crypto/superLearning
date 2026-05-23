import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required scopes
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/chat.spaces.readonly');
provider.addScope('https://www.googleapis.com/auth/chat.messages');
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/forms.body');
provider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');

// In-memory token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listiner
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // If we don't have token but user is logged in, we might need to prompt login or get it.
      // Firebase doesn't persist the Google access token in the session storage.
      // So if the page is refreshed, cachedAccessToken is null.
      // In this case, we have a logged-in user but no access token.
      // We will ask them to sign in again to retrieve the access token when they try to use Tasks.
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google OAuth access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Core Auth error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleSignOut = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Google Tasks API integrations
 */

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  completed?: string;
  updated?: string;
}

// 1. Fetch all Task Lists
export const fetchTaskLists = async (token: string): Promise<GoogleTaskList[]> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch task lists: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return data.items || [];
};

// 2. Create a new Task List
export const createTaskList = async (token: string, title: string): Promise<GoogleTaskList> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create task list: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 3. Fetch Tasks within list
export const fetchTasks = async (token: string, taskListId: string): Promise<GoogleTask[]> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?showCompleted=true&showHidden=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch tasks: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return data.items || [];
};

// 4. Create a task
export const createTask = async (
  token: string,
  taskListId: string,
  task: { title: string; notes?: string; status?: 'needsAction' | 'completed' }
): Promise<GoogleTask> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create task: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 5. Update a task's status or details
export const updateTaskStatus = async (
  token: string,
  taskListId: string,
  taskId: string,
  status: 'needsAction' | 'completed'
): Promise<GoogleTask> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update task: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 6. Delete task with confirmation warning
export const deleteTask = async (
  token: string,
  taskListId: string,
  taskId: string
): Promise<void> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete task: ${res.statusText}. details: ${errText}`);
  }
};

/**
 * Google Calendar API integrations
 */
export interface GoogleCalendarResource {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
}

// 1. Fetch Calendar list
export const fetchCalendars = async (token: string): Promise<GoogleCalendarResource[]> => {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch calendars: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return data.items || [];
};

// 2. Fetch Events for a specific calendar
export const fetchCalendarEvents = async (
  token: string, 
  calendarId: string, 
  timeMin?: string
): Promise<GoogleCalendarEvent[]> => {
  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=50&orderBy=startTime&singleEvents=true`;
  if (timeMin) {
    url += `&timeMin=${encodeURIComponent(timeMin)}`;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch events: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return data.items || [];
};

// 3. Create Event in specific calendar
export const createCalendarEvent = async (
  token: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
  }
): Promise<GoogleCalendarEvent> => {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create calendar event: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 4. Delete Event from specific calendar
export const deleteCalendarEvent = async (
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> => {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete calendar event: ${res.statusText}. details: ${errText}`);
  }
};


/**
 * Google Docs API integrations
 */
export interface GoogleDoc {
  documentId: string;
  title: string;
  body?: { content?: any[] };
}

// 1. Create a document
export const createGoogleDoc = async (token: string, title: string): Promise<GoogleDoc> => {
  const res = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create document: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 2. Fetch a document by ID
export const getGoogleDoc = async (token: string, documentId: string): Promise<GoogleDoc> => {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch document: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 3. BatchUpdate (append structure or write content)
export const appendGoogleDocText = async (
  token: string,
  documentId: string,
  text: string
): Promise<any> => {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: {}, // Appends to the end
            text: text
          }
        }
      ]
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to append text: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};


/**
 * Google Chat API integrations
 */
export interface GoogleChatSpace {
  name: string; // e.g. "spaces/ABCDE"
  displayName: string;
  type: string; // "ROOM" or "DM"
}

export interface GoogleChatMessage {
  name: string;
  text: string;
  createTime: string;
}

// 1. Fetch Chat Spaces
export const fetchChatSpaces = async (token: string): Promise<GoogleChatSpace[]> => {
  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch chat spaces: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return data.spaces || [];
};

// 2. Send Message to Space
export const sendChatMessage = async (
  token: string,
  spaceName: string, // e.g. "spaces/ABCDE"
  text: string
): Promise<GoogleChatMessage> => {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to send chat message: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};


/**
 * Google Sheets API integrations
 */
export interface GoogleSpreadsheet {
  spreadsheetId: string;
  properties: { title: string };
  spreadsheetUrl?: string;
}

// 1. Create a Spreadsheet
export const createGoogleSpreadsheet = async (token: string, title: string): Promise<GoogleSpreadsheet> => {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title }
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create spreadsheet: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    properties: data.properties,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
  };
};

// 2. Append rows to a range
export const appendSpreadsheetValues = async (
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to append values to sheet: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 3. Get values from a range
export const getSpreadsheetValues = async (
  token: string,
  spreadsheetId: string,
  range: string
): Promise<any[][]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch sheet values: ${res.statusText}. details: ${errText}`);
  }
  const data = await res.json();
  return data.values || [];
};


/**
 * Google Forms API integrations
 */
export interface GoogleForm {
  formId: string;
  info: { title: string; documentTitle?: string };
  responderUri: string;
}

// 1. Create Form
export const createGoogleForm = async (token: string, title: string): Promise<GoogleForm> => {
  const res = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: { title }
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Google Form: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};

// 2. Add Questions via batchUpdate
export const addQuestionsToGoogleForm = async (
  token: string,
  formId: string,
  questions: Array<{ title: string; options?: string[] }>
): Promise<any> => {
  const requests = questions.map((q, index) => {
    const item: any = {
      title: q.title,
      questionItem: {
        question: {
          required: true,
        }
      }
    };

    if (q.options && q.options.length > 0) {
      item.questionItem.question.choiceQuestion = {
        type: 'RADIO',
        options: q.options.map(o => ({ value: o }))
      };
    } else {
      item.questionItem.question.textQuestion = {};
    }

    return {
      createItem: {
        item,
        location: { index }
      }
    };
  });

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to add questions to form: ${res.statusText}. details: ${errText}`);
  }
  return await res.json();
};
