import React from 'react';

// Version ultra-simple pour tester le rendu
const SimpleApp = () => {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f8ff',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }
  }, [
    React.createElement('h1', {
      key: 'title',
      style: {
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#2E7D32',
        marginBottom: '10px',
        textAlign: 'center'
      }
    }, '🎉 TerranoKidsFind'),

    React.createElement('h2', {
      key: 'subtitle',
      style: {
        fontSize: '20px',
        color: '#1976D2',
        marginBottom: '30px',
        textAlign: 'center'
      }
    }, 'Application Web Fonctionnelle'),

    React.createElement('p', {
      key: 'success',
      style: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#4CAF50',
        marginTop: '20px',
        textAlign: 'center'
      }
    }, 'L\'application fonctionne parfaitement !')
  ]);
};

export default SimpleApp;