import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
    });
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the profile form before chat', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Chat Shuru Karein');
    expect(compiled.querySelector('.chat-container')).toBeNull();
  });

  it('should only start chat with a valid profile', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.username = 'Al';
    app.age = 17;
    app.gender = '';
    app.startChat();
    expect(app.chatStarted).toBe(false);

    app.username = 'Rajendra';
    app.age = 25;
    app.gender = 'Male';
    app.isHuman = true;
    app.startChat();
    expect(app.chatStarted).toBe(true);
  });

  it('should limit age input to two digits', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const input = document.createElement('input');
    input.value = '123';

    app.limitAge({ target: input } as unknown as Event);

    expect(input.value).toBe('12');
    expect(app.age).toBe(12);
  });

  it('should limit username to 20 characters', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.limitUsername('1234567890123456789012345');

    expect(app.username).toBe('12345678901234567890');
  });
});
