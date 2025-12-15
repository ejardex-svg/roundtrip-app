import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { XCircle } from 'lucide-react';

const PaymentCancel = ({ user }) => {
  const navigate = useNavigate();

  const handleContinue = () => {
    if (user?.roles?.includes('cliente')) {
      navigate('/cliente');
    } else {
      navigate('/transportista');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 rounded-3xl">
        <CardHeader className="text-center pb-2">
          <XCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <CardTitle className="text-2xl text-amber-600">Pago Cancelado</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Has cancelado el proceso de pago. No se ha realizado ningún cargo a tu cuenta.
          </p>
          
          <Button 
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-full"
          >
            Volver al Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancel;
