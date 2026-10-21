/** Synthetic source IDs and people; curated multilingual title spellings for repeatable search evaluation. */
export const titles = [
  ['Tên cậu là gì', 'Your Name', 'Kimi no Na wa'], ['Vùng đất linh hồn', 'Spirited Away', 'Sen to Chihiro no Kamikakushi'],
  ['Lâu đài bay của pháp sư Howl', 'Howls Moving Castle', 'Hauru no Ugoku Shiro'], ['Hàng xóm của tôi là Totoro', 'My Neighbor Totoro', 'Tonari no Totoro'],
  ['Dáng hình thanh âm', 'A Silent Voice', 'Koe no Katachi'], ['Đứa con của thời tiết', 'Weathering With You', 'Tenki no Ko'],
  ['Khóa chặt cửa nào Suzume', 'Suzume', 'Suzume no Tojimari'], ['Công chúa Mononoke', 'Princess Mononoke', 'Mononoke Hime'],
  ['Năm centimet trên giây', 'Five Centimeters per Second', 'Byousoku 5 Centimeter'], ['Khu vườn ngôn từ', 'The Garden of Words', 'Kotonoha no Niwa'],
  ['Mộ đom đóm', 'Grave of the Fireflies', 'Hotaru no Haka'], ['Cô gái vượt thời gian', 'The Girl Who Leapt Through Time', 'Toki wo Kakeru Shoujo'],
  ['Đại chiến Titan', 'Attack on Titan', 'Shingeki no Kyojin'], ['Thanh gươm diệt quỷ', 'Demon Slayer', 'Kimetsu no Yaiba'],
  ['Chú thuật hồi chiến', 'Jujutsu Kaisen', '呪術廻戦'], ['Gia đình điệp viên', 'Spy Family', 'スパイファミリー'],
  ['Thợ săn quỷ', 'Chainsaw Man', 'チェンソーマン'], ['Học viện siêu anh hùng', 'My Hero Academia', 'Boku no Hero Academia'],
  ['Thám tử lừng danh Conan', 'Detective Conan', 'Meitantei Conan'], ['Vua hải tặc', 'One Piece', 'ワンピース'],
  ['Cuốn sổ tử thần', 'Death Note', 'デスノート'], ['Giả kim thuật sư', 'Fullmetal Alchemist', 'Hagane no Renkinjutsushi'],
  ['Người hùng một đấm', 'One Punch Man', 'ワンパンマン'], ['Cuộc chiến chén thánh', 'Fate Zero', 'フェイトゼロ'],
  ['Bóng rổ đường phố', 'Slam Dunk', 'スラムダンク'], ['Cổng thời gian', 'Steins Gate', 'シュタインズゲート'],
  ['Ký sinh trùng', 'Parasite', 'Gisaengchung'], ['Kẻ đánh cắp giấc mơ', 'Inception', 'Khởi nguồn'],
  ['Hố đen tử thần', 'Interstellar', 'Giữa các vì sao'], ['Kỵ sĩ bóng đêm', 'The Dark Knight', 'Hiệp sĩ bóng đêm'],
];
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
export const queries = titles.flatMap((names, index) => {
  const id = index + 1;
  return [
    { query: `tmdb:movie:${id}`, expected: id, group: 'id' },
    ...names.map((query) => ({ query, expected: id, group: 'exact' })),
    { query: fold(names[0]), expected: id, group: 'folded' },
    { query: names[1].slice(0, 3) + names[1].slice(4), expected: id, group: 'typo' },
    { query: `Diễn viên ${id} thử nghiệm`, field: 'actor', expected: id, group: 'entity' },
    { query: `Đạo diễn ${id} thử nghiệm`, field: 'director', expected: id, group: 'entity' },
  ];
}).concat([
  { query: 'tmdb:tv:1', expected: 10001, group: 'namespace' },
  { query: 'tmdb:movie:999999', expected: null, group: 'missing' },
  { query: 'zzqqvvuuyyxxyyzz', expected: null, group: 'missing' },
]);
