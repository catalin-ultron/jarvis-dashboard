export interface Session {
  id: string;
  name: string;
  model: string;
  total_cost: number | null;
  total_tokens: number | null;
  message_count: number | null;
  tool_count: number | null;
  duration: number | null; // in seconds  
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  model?: string | null;
  content?: string | null;
  tool_name?: string | null;
  tool_input?: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  created_at: string;
}
