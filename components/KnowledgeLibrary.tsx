
import React from 'react';
import { Note, Flashcard } from '../types';

interface KnowledgeLibraryProps {
  notes: Note[];
  cards: Flashcard[];
  onDeleteNote: (id: string) => void;
  onDeleteCard: (id: string) => void;
  onSelectNote: (id: string) => void;
}

export const KnowledgeLibrary: React.FC<KnowledgeLibraryProps> = ({ notes, cards, onDeleteNote, onDeleteCard, onSelectNote }) => {
  return (
    <div className="max-w-6xl mx-auto space-y-12 py-6 h-full overflow-y-auto custom-scrollbar">
      <section>
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 px-1 text-zinc-200 tracking-tight">
          <i className="fas fa-folder-open text-apple-blue text-sm"></i>
          所有知识集 ({notes.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {notes.map(note => (
            <div key={note.id} className="bg-[#1c1c1e] border border-white/5 p-6 rounded-2xl relative shadow-sm group hover:border-zinc-700 hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[170px]">
              <div>
                <div className="flex justify-between items-center mb-3.5">
                  <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                    <i className={`fas ${note.type === 'pdf' ? 'fa-file-pdf text-apple-red' : 'fa-align-left text-apple-blue'} text-sm`}></i>
                  </div>
                  <button onClick={() => onDeleteNote(note.id)} className="text-zinc-650 hover:text-apple-red opacity-0 group-hover:opacity-100 transition duration-250">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
                <h4 className="font-semibold text-zinc-100 text-sm tracking-tight truncate mb-1">{note.title}</h4>
                <p className="text-[10px] text-zinc-500 font-mono">{new Date(note.updatedAt).toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => onSelectNote(note.id)}
                className="w-full mt-5 py-2.5 bg-[#2c2c2e] hover:bg-[#323236] border border-white/5 rounded-xl text-xs font-semibold tracking-tight text-zinc-200 transition"
              >
                工作区编译
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 px-1 text-zinc-200 tracking-tight">
          <i className="fas fa-brain text-apple-purple text-sm"></i>
          神经记忆颗粒 ({cards.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(card => (
            <div key={card.id} className="bg-[#1c1c1e]/60 border border-white/5 p-5 rounded-2xl flex flex-col justify-between group hover:border-[#3a3a3c] transition duration-200 min-h-[130px]">
               <div className="text-xs text-zinc-350 mb-3.5 line-clamp-3 leading-relaxed">"{card.front}"</div>
               <div className="flex justify-between items-center mt-auto pt-2 border-t border-white/5">
                 <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold font-mono ${
                   card.level > 3 
                     ? 'bg-apple-green/10 text-apple-green border border-apple-green/15' 
                     : 'bg-zinc-800 text-zinc-400 border border-white/5'
                 }`}>
                   掌握度: {card.level}
                 </span>
                 <button onClick={() => onDeleteCard(card.id)} className="text-zinc-650 hover:text-apple-red transition opacity-0 group-hover:opacity-100">
                   <i className="fas fa-times text-xs"></i>
                 </button>
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
