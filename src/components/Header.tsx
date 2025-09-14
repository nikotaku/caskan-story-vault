import caskanLogo from "@/assets/caskan-logo.png";

export const Header = () => {
  return (
    <header className="w-full py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-center">
          <a href="/" className="block">
            <img 
              src={caskanLogo} 
              alt="Caskan" 
              className="h-16 w-auto"
            />
          </a>
        </div>
      </div>
    </header>
  );
};