interface SectionHeadingProps {
  english: string;
  japanese: string;
}

export const SectionHeading = ({ english, japanese }: SectionHeadingProps) => {
  return (
    <h2 className="text-center mb-8">
      <div
        className="text-2xl md:text-3xl font-bold tracking-widest"
        style={{
          color: "#8b7355",
          fontFamily: "'Noto Serif JP', serif",
        }}
      >
        {english}
      </div>
      <div className="text-sm text-[#a89586] mt-1 tracking-wider">
        {japanese}
      </div>
    </h2>
  );
};
