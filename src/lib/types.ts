export type SearchArtist = {
  n: string;
  ln: string;
  img?: string[];
};

export type SearchPost = {
  ln: string;
  n: string;
  cats: SearchArtist[];
};

export type SearchResponse = {
  success: boolean;
  data: {
    posts: SearchPost[];
    cats: SearchArtist[];
  };
};

export type SongData = {
  url: string;
  canonicalUrl: string;
  title: string;
  artist: string;
  artistUrl?: string;
  key?: string;
  chordsText: string;
  description?: string;
  youtubeUrl?: string;
  credits?: string;
  extractedAt: string;
};

export type ArtistSong = {
  title: string;
  url: string;
};

export type ArtistData = {
  url: string;
  canonicalUrl: string;
  name: string;
  songs: ArtistSong[];
  description?: string;
  imageUrl?: string;
  extractedAt: string;
};

export type SongUiState = {
  semitones: number;
  fontSize: number;
  simplify: boolean;
  autoscrollSpeed: number;
};
